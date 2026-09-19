import { app, InvocationContext, output, StorageBlobOutput } from '@azure/functions';
import {
  BlobTriggerEvent,
  BlobTriggerFunction,
  BlobTriggerOutput,
  BlobTriggerResponse,
} from './blob.payload';

function normalizeExtension(extension: string): string {
  const lower = extension.toLowerCase();
  return lower.startsWith('.') ? lower : `.${lower}`;
}

export class BlobTrigger {
  protected allowedExtensions: string[] = [];
  protected fromContainerName = '';
  protected toContainerName = '';
  protected connectionName = '';
  protected outputs: BlobTriggerOutput[] = [];

  protected constructor(protected readonly triggerName: string) {}

  static create(triggerName: string): BlobTrigger {
    if (!triggerName.trim()) {
      throw new Error('triggerName must be a non-empty string.');
    }

    return new BlobTrigger(triggerName);
  }

  /**
   * Restrict processing to the given file extensions.
   * An empty list means all extensions are allowed.
   */
  allow(extensions: string[]): this {
    this.allowedExtensions = extensions.map(normalizeExtension);
    return this;
  }

  fromContainer(name: string): this {
    this.fromContainerName = name;
    return this;
  }

  toContainer(name: string): this {
    this.toContainerName = name;
    return this;
  }

  /**
   * App setting (or environment variable) name that holds the storage connection string.
   */
  withConnection(name: string): this {
    this.connectionName = name;
    return this;
  }

  addOutput(bindingName: string, path: string): this {
    if (!bindingName.trim()) {
      throw new Error('bindingName must be a non-empty string.');
    }

    if (!path.trim()) {
      throw new Error('path must be a non-empty string.');
    }

    this.outputs.push({ bindingName, path });
    return this;
  }

  register(trigger: BlobTriggerFunction): this {
    this.assertReady();

    const extraOutputs = this.buildExtraOutputs();

    app.storageBlob(this.triggerName, {
      path: `${this.fromContainerName}/{path}.{ext}`,
      connection: this.connectionName,
      extraOutputs,
      handler: (blob: Buffer, context: InvocationContext) =>
        this.handler(blob, context, extraOutputs, trigger),
    });

    return this;
  }

  /**
   * Builds storage blob output bindings for the configured destinations.
   * Exposed for tests and advanced hosting scenarios.
   */
  buildExtraOutputs(): StorageBlobOutput[] {
    return this.outputs.map((item) => {
      const blobOutput = output.storageBlob({
        path: `${this.toContainerName}/${item.path}`,
        connection: this.connectionName,
      });

      blobOutput.name = item.bindingName;
      return blobOutput;
    });
  }

  /**
   * Runs the extension filter and user handler without registering with the Functions host.
   * Useful for unit tests.
   */
  async process(
    blob: Buffer,
    context: InvocationContext,
    extraOutputs: StorageBlobOutput[],
    trigger: BlobTriggerFunction,
  ): Promise<void> {
    return this.handler(blob, context, extraOutputs, trigger);
  }

  protected assertReady(): void {
    if (!this.fromContainerName.trim()) {
      throw new Error('fromContainer() must be called before register().');
    }

    if (!this.toContainerName.trim()) {
      throw new Error('toContainer() must be called before register().');
    }

    if (!this.connectionName.trim()) {
      throw new Error('withConnection() must be called before register().');
    }
  }

  protected async handler(
    blob: Buffer,
    context: InvocationContext,
    extraOutputs: StorageBlobOutput[],
    trigger: BlobTriggerFunction,
  ): Promise<void> {
    const event = BlobTriggerEvent.create(blob, context);
    const response = BlobTriggerResponse.create(event, extraOutputs);

    if (this.allowedExtensions.length > 0) {
      const isAllowedExtension = this.allowedExtensions.includes(event.extension());

      if (!isAllowedExtension) {
        context.log(
          `[!] Rejected file with disallowed extension (${event.extension() || '(none)'})...`,
        );
        context.log(`[!] Expected extensions (${this.allowedExtensions.join(', ')})...`);
        return;
      }
    }

    context.log(`[?] Received blob "${event.blobName()}"...`);
    context.log(`[?] File size of ${blob.length} bytes...`);

    await trigger(event, response);
  }
}
