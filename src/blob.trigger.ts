import { app, InvocationContext, StorageBlobOutput } from '@azure/functions';
import { BlobTriggerEvent, BlobTriggerFunction, BlobTriggerOutput, BlobTriggerResponse } from './blob.payload';

export class BlobTrigger {

  protected allowedExtensions: string[] = [];
  protected fromContainerName: string = '';
  protected toContainerName: string = '';
  protected connectionName: string = '';
  protected outputs: BlobTriggerOutput[] = [];

  private constructor(protected readonly triggerName: string) {}
  
  static create(triggerName: string) {
    return new BlobTrigger(triggerName);
  }

  allow(extensions: string[]) {
    this.allowedExtensions = extensions;
    return this;
  }

  fromContainer(name: string) {
    this.fromContainerName = name;
    return this;
  }

  toContainer(name: string) {
    this.toContainerName = name;
    return this;
  }

  withConnection(name: string) {
    this.connectionName = name;
    return this;
  }

  addOutput(bindingName: string, path: string) {
    this.outputs.push({
      bindingName,
      path
    });
    return this;
  }

  register(trigger: BlobTriggerFunction) {
    const extraOutputs = this.outputs.map((output): StorageBlobOutput => ({
      name: output.bindingName,
      path: `${this.toContainerName}/${output.path}`,
      connection: this.connectionName,
      type: 'blob'
    }));

    app.storageBlob(this.triggerName, {
      path: `${this.fromContainerName}/{path}.{ext}`,
      connection: this.connectionName,
      extraOutputs,
      handler: (blob: Buffer, context: InvocationContext) => this.handler(blob, context, extraOutputs, trigger),
    });
  }

  protected async handler(
    blob: Buffer, 
    context: InvocationContext, 
    extraOutputs: StorageBlobOutput[],
    trigger: BlobTriggerFunction
  ) {
    const event = BlobTriggerEvent.create(blob, context);
    const response = BlobTriggerResponse.create(event, extraOutputs);

    const isAllowedExtension = this.allowedExtensions.some((allowedExtension) => {
      return event.extension() == allowedExtension.toLowerCase();
    });

    if (!isAllowedExtension) {
      context.log(`[!] Rejected file with disallowed extension (${event.extension()})...`);
      context.log(`[!] Expected extensions (${this.allowedExtensions.join(', ')})...`);
      return;
    }

    context.log(`[?] Received blob "${event.path() + event.extension()}"...`);
    context.log(`[?] File size of ${blob.length} bytes...`);

    return await trigger(event, response);
  }

}
