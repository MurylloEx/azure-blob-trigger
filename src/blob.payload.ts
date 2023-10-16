import { InvocationContext, StorageBlobOutput, TriggerMetadata } from '@azure/functions';

export type BlobTriggerFunction = (
  event: BlobTriggerEvent, 
  response: BlobTriggerResponse,
) => Promise<void>;

export type BlobTriggerOutput = {
  bindingName: string;
  path: string;
}

export class BlobTriggerEvent {
  
  private constructor(
    protected buffer: Buffer, 
    protected invocation: InvocationContext
  ) {}

  static create(blob: Buffer, context: InvocationContext) {
    return new BlobTriggerEvent(blob, context);
  }

  blob(): Buffer {
    return this.buffer;
  }

  context(): InvocationContext {
    return this.invocation;
  }

  metadata(): TriggerMetadata {
    return this.invocation.triggerMetadata || {};
  }

  path(): string {
    return String(this.metadata().path);
  }

  extension(): string {
    return '.' + String(this.metadata().ext).toLowerCase();
  }

}

export class BlobTriggerResponse {
  
  private constructor(
    protected event: BlobTriggerEvent,
    protected extraOutputs: StorageBlobOutput[],
  ) {}

  static create(
    event: BlobTriggerEvent,
    extraOutputs: StorageBlobOutput[]
  ) {
    return new BlobTriggerResponse(event, extraOutputs);
  }

  addFile(bindingName: string, blob: Buffer) {
    const foundOutput = this.extraOutputs.find(({ name }) => bindingName == name);
    
    if (foundOutput) {
      this.event.context().extraOutputs.set(foundOutput, blob);
    }

    return this;
  }

}
