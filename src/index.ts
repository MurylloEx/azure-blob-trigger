import { BlobTrigger } from './blob.trigger';

async function bootstrap() {
  BlobTrigger.create('<trigger-name>')
    .allow(['.txt', '.log', '.csv'])
    .fromContainer('<name>')
    .toContainer('<name>')
    .withConnection('StorageAccountConnectionString')
    .addOutput('file1', '{path}-Copy.{ext}')
    .register(async (event, response) => {
      event.context().log('Hello World');
      response.addFile('file1', event.blob());
    });
}

bootstrap();
