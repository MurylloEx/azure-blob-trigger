import { extname } from 'path';
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
    protected outputs: BlobTriggerOutput[],
    protected connectionName: string,
    protected destinationContainer: string,
  ) {}

  static create(
    event: BlobTriggerEvent,
    outputs: BlobTriggerOutput[],
    connectionName: string,
    destinationContainer: string,
  ) {
    return new BlobTriggerResponse(
      event,
      outputs,
      connectionName,
      destinationContainer,
    );
  }

  addFile(name: string, blob: Buffer) {
    const foundOutput = this.outputs.find(({ bindingName }) => bindingName == name);
    
    if (foundOutput) {
      const blobOutput: StorageBlobOutput = {
        name: foundOutput.bindingName,
        path: `${this.destinationContainer}/${foundOutput.path}`,
        connection: this.connectionName,
        type: 'blob',
      };
  
      this.event.context().extraOutputs.set(blobOutput, blob);
    }

    return this;
  }

}
