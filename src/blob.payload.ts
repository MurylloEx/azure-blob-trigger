import { InvocationContext, StorageBlobOutput, TriggerMetadata } from '@azure/functions';

export type BlobTriggerFunction = (
  event: BlobTriggerEvent,
  response: BlobTriggerResponse,
) => Promise<void>;

export type BlobTriggerOutput = {
  bindingName: string;
  path: string;
};

export class BlobTriggerEvent {
  private constructor(
    protected buffer: Buffer,
    protected invocation: InvocationContext,
  ) {}

  static create(blob: Buffer, context: InvocationContext): BlobTriggerEvent {
    return new BlobTriggerEvent(blob, context);
  }

  blob(): Buffer {
    return this.buffer;
  }

  context(): InvocationContext {
    return this.invocation;
  }

  metadata(): TriggerMetadata {
    return this.invocation.triggerMetadata ?? {};
  }

  /**
   * Blob path segment from the trigger binding (`{path}` in `{path}.{ext}`).
   */
  path(): string {
    const value = this.metadata().path;
    return value == null ? '' : String(value);
  }

  /**
   * Normalized file extension including the leading dot (e.g. `.txt`).
   */
  extension(): string {
    const value = this.metadata().ext;
    if (value == null || value === '') {
      return '';
    }

    const raw = String(value).toLowerCase();
    return raw.startsWith('.') ? raw : `.${raw}`;
  }

  /**
   * Full relative blob name reconstructed from path + extension.
   */
  blobName(): string {
    const path = this.path();
    const extension = this.extension();

    if (!path) {
      return extension;
    }

    if (!extension) {
      return path;
    }

    return `${path}${extension}`;
  }
}

export class BlobTriggerResponse {
  private constructor(
    protected event: BlobTriggerEvent,
    protected extraOutputs: StorageBlobOutput[],
  ) {}

  static create(
    event: BlobTriggerEvent,
    extraOutputs: StorageBlobOutput[],
  ): BlobTriggerResponse {
    return new BlobTriggerResponse(event, extraOutputs);
  }

  /**
   * Writes a blob to a previously registered output binding.
   * @throws If `bindingName` was not registered via `addOutput`.
   */
  addFile(bindingName: string, blob: Buffer): this {
    const foundOutput = this.extraOutputs.find(({ name }) => bindingName === name);

    if (!foundOutput) {
      const known = this.extraOutputs.map(({ name }) => name).join(', ') || '(none)';
      throw new Error(
        `Unknown blob output binding "${bindingName}". Registered bindings: ${known}.`,
      );
    }

    this.event.context().extraOutputs.set(foundOutput, blob);
    return this;
  }
}
