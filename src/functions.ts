import { BlobTrigger } from './blob.trigger';

/**
 * Sample Azure Functions entry point.
 * Replace placeholder container names and the connection setting before running locally
 * or deploying. See README for `local.settings.json` setup.
 */
BlobTrigger.create('BlobCopyTrigger')
  .allow(['.txt', '.log', '.csv'])
  .fromContainer(process.env.BLOB_TRIGGER_SOURCE_CONTAINER ?? 'incoming')
  .toContainer(process.env.BLOB_TRIGGER_DEST_CONTAINER ?? 'processed')
  .withConnection(process.env.BLOB_TRIGGER_CONNECTION ?? 'AzureWebJobsStorage')
  .addOutput('file1', '{path}-Copy.{ext}')
  .register(async (event, response) => {
    event.context().log(`Copying blob ${event.blobName()}`);
    response.addFile('file1', event.blob());
  });
