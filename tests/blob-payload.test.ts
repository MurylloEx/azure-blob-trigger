import { InvocationContext, output } from '@azure/functions';
import { BlobTriggerEvent, BlobTriggerResponse } from '../src/blob.payload';

function createContext(metadata: Record<string, unknown> = {}): InvocationContext {
  return new InvocationContext({
    invocationId: 'test-invocation',
    functionName: 'test-function',
    triggerMetadata: metadata,
  });
}

describe('BlobTriggerEvent', () => {
  it('exposes blob bytes and context', () => {
    const blob = Buffer.from('hello');
    const context = createContext({ path: 'reports/daily', ext: 'csv' });
    const event = BlobTriggerEvent.create(blob, context);

    expect(event.blob()).toBe(blob);
    expect(event.context()).toBe(context);
    expect(event.path()).toBe('reports/daily');
    expect(event.extension()).toBe('.csv');
    expect(event.blobName()).toBe('reports/daily.csv');
  });

  it('normalizes extensions with or without a leading dot', () => {
    expect(BlobTriggerEvent.create(Buffer.alloc(0), createContext({ ext: 'TXT' })).extension()).toBe(
      '.txt',
    );
    expect(BlobTriggerEvent.create(Buffer.alloc(0), createContext({ ext: '.Log' })).extension()).toBe(
      '.log',
    );
  });

  it('handles missing path and extension metadata', () => {
    const event = BlobTriggerEvent.create(Buffer.alloc(0), createContext());

    expect(event.path()).toBe('');
    expect(event.extension()).toBe('');
    expect(event.blobName()).toBe('');
    expect(event.metadata()).toEqual({});
  });
});

describe('BlobTriggerResponse', () => {
  it('writes to a registered output binding', () => {
    const context = createContext({ path: 'a', ext: 'txt' });
    const event = BlobTriggerEvent.create(Buffer.from('payload'), context);
    const blobOutput = output.storageBlob({
      path: 'processed/{path}-Copy.{ext}',
      connection: 'AzureWebJobsStorage',
    });
    blobOutput.name = 'file1';

    const response = BlobTriggerResponse.create(event, [blobOutput]);
    const content = Buffer.from('copied');

    response.addFile('file1', content);

    expect(context.extraOutputs.get(blobOutput)).toBe(content);
  });

  it('throws when the binding name is unknown', () => {
    const event = BlobTriggerEvent.create(Buffer.alloc(0), createContext());
    const response = BlobTriggerResponse.create(event, []);

    expect(() => response.addFile('missing', Buffer.alloc(0))).toThrow(/Unknown blob output binding/);
  });
});
