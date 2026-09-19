import { app, InvocationContext } from '@azure/functions';
import { BlobTrigger } from '../src/blob.trigger';

function createContext(metadata: Record<string, unknown> = {}): {
  context: InvocationContext;
  logs: string[];
} {
  const logs: string[] = [];
  const context = new InvocationContext({
    invocationId: 'test-invocation',
    functionName: 'test-function',
    triggerMetadata: metadata,
    logHandler: (_level, ...args) => {
      logs.push(args.map(String).join(' '));
    },
  });

  return { context, logs };
}

describe('BlobTrigger', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires a non-empty trigger name', () => {
    expect(() => BlobTrigger.create('')).toThrow(/non-empty/);
    expect(() => BlobTrigger.create('   ')).toThrow(/non-empty/);
  });

  it('validates required configuration before register', () => {
    expect(() => BlobTrigger.create('copy').register(async () => undefined)).toThrow(
      /fromContainer/,
    );

    expect(() =>
      BlobTrigger.create('copy').fromContainer('in').register(async () => undefined),
    ).toThrow(/toContainer/);

    expect(() =>
      BlobTrigger.create('copy')
        .fromContainer('in')
        .toContainer('out')
        .register(async () => undefined),
    ).toThrow(/withConnection/);
  });

  it('registers a storage blob function with named outputs', () => {
    const spy = jest.spyOn(app, 'storageBlob').mockImplementation(() => undefined);

    BlobTrigger.create('BlobCopyTrigger')
      .allow(['txt', '.CSV'])
      .fromContainer('incoming')
      .toContainer('processed')
      .withConnection('AzureWebJobsStorage')
      .addOutput('file1', '{path}-Copy.{ext}')
      .register(async () => undefined);

    expect(spy).toHaveBeenCalledTimes(1);
    const [name, options] = spy.mock.calls[0];
    expect(name).toBe('BlobCopyTrigger');
    expect(options.path).toBe('incoming/{path}.{ext}');
    expect(options.connection).toBe('AzureWebJobsStorage');
    expect(options.extraOutputs).toHaveLength(1);
    expect(options.extraOutputs?.[0].name).toBe('file1');
    expect(options.extraOutputs?.[0].path).toBe('processed/{path}-Copy.{ext}');
  });

  it('rejects disallowed extensions and skips the user handler', async () => {
    const trigger = BlobTrigger.create('copy')
      .allow(['.txt'])
      .fromContainer('in')
      .toContainer('out')
      .withConnection('AzureWebJobsStorage');

    const { context, logs } = createContext({ path: 'notes', ext: 'pdf' });
    const userHandler = jest.fn(async () => undefined);

    await trigger.process(Buffer.from('x'), context, [], userHandler);

    expect(userHandler).not.toHaveBeenCalled();
    expect(logs.some((line) => line.includes('Rejected'))).toBe(true);
  });

  it('allows all extensions when allow() was not configured', async () => {
    const trigger = BlobTrigger.create('copy')
      .fromContainer('in')
      .toContainer('out')
      .withConnection('AzureWebJobsStorage')
      .addOutput('file1', '{path}-Copy.{ext}');

    const { context } = createContext({ path: 'notes', ext: 'pdf' });
    const outputs = trigger.buildExtraOutputs();
    const userHandler = jest.fn(async (event, response) => {
      response.addFile('file1', event.blob());
    });

    const blob = Buffer.from('payload');
    await trigger.process(blob, context, outputs, userHandler);

    expect(userHandler).toHaveBeenCalledTimes(1);
    expect(context.extraOutputs.get(outputs[0])).toBe(blob);
  });

  it('invokes the user handler for allowed extensions', async () => {
    const trigger = BlobTrigger.create('copy')
      .allow(['.txt', '.log'])
      .fromContainer('in')
      .toContainer('out')
      .withConnection('AzureWebJobsStorage')
      .addOutput('file1', '{path}-Copy.{ext}');

    const { context } = createContext({ path: 'notes', ext: 'TXT' });
    const outputs = trigger.buildExtraOutputs();
    const blob = Buffer.from('hello');
    const userHandler = jest.fn(async (event, response) => {
      expect(event.blobName()).toBe('notes.txt');
      response.addFile('file1', event.blob());
    });

    await trigger.process(blob, context, outputs, userHandler);

    expect(userHandler).toHaveBeenCalledTimes(1);
    expect(context.extraOutputs.get(outputs[0])).toEqual(blob);
  });
});
