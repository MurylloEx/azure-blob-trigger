# azure-blob-trigger

Fluent TypeScript helpers for **Azure Functions v4** Storage Blob triggers: filter by file extension, declare multiple blob outputs, and write results through a small builder API on top of [`@azure/functions`](https://www.npmjs.com/package/@azure/functions).

## Purpose

Azure Functions Node.js programming model v4 registers triggers in code (`app.storageBlob`), but wiring extension allow-lists, destination containers, and named extra outputs still tends to scatter across handlers. This project provides a fluent `BlobTrigger` builder plus `BlobTriggerEvent` / `BlobTriggerResponse` helpers so a blob-copy (or transform) function stays declarative and testable.

It also ships a ready-to-run sample function entry (`src/functions.ts`) that copies allowed blobs from a source container to a destination container.

## Problem solved

Without helpers you typically:

- Hand-roll `path` / `connection` / `extraOutputs` objects
- Re-parse `triggerMetadata` for `{path}` and `{ext}`
- Forget to reject unwanted file types early
- Call `context.extraOutputs.set` with the wrong binding object or name

`BlobTrigger` centralizes that flow:

```ts
import { BlobTrigger } from 'azure-blob-trigger';

BlobTrigger.create('BlobCopyTrigger')
  .allow(['.txt', '.log', '.csv'])
  .fromContainer('incoming')
  .toContainer('processed')
  .withConnection('AzureWebJobsStorage')
  .addOutput('file1', '{path}-Copy.{ext}')
  .register(async (event, response) => {
    event.context().log(`Copying ${event.blobName()}`);
    response.addFile('file1', event.blob());
  });
```

## Requirements

- Node.js **22+** (CI also covers 24 and 26)
- Azure Functions runtime **v4** with the Node.js programming model v4
- An Azure Storage account (or Azurite for local development)
- [Azure Functions Core Tools](https://learn.microsoft.com/azure/azure-functions/functions-run-local) (`func`) to run the sample locally

## Install

As a dependency in another Functions app:

```bash
npm install azure-blob-trigger
```

Or clone this repository and install locally:

```bash
git clone https://github.com/MurylloEx/azure-blob-trigger.git
cd azure-blob-trigger
npm install
```

## Quick start (library)

```ts
import { BlobTrigger } from 'azure-blob-trigger';

BlobTrigger.create('ProcessReports')
  .allow(['.csv']) // omit or pass [] to allow every extension
  .fromContainer('reports-in')
  .toContainer('reports-out')
  .withConnection('AzureWebJobsStorage')
  .addOutput('archive', 'archive/{path}.{ext}')
  .addOutput('copy', '{path}-Copy.{ext}')
  .register(async (event, response) => {
    const bytes = event.blob();
    response.addFile('archive', bytes).addFile('copy', bytes);
  });
```

### Event helpers

| Method | Description |
| --- | --- |
| `event.blob()` | Trigger blob as `Buffer` |
| `event.context()` | Azure `InvocationContext` |
| `event.metadata()` | Raw `triggerMetadata` |
| `event.path()` | `{path}` binding segment |
| `event.extension()` | Normalized extension with leading `.` |
| `event.blobName()` | `path` + `extension` |

### Response helpers

| Method | Description |
| --- | --- |
| `response.addFile(bindingName, blob)` | Sets the named extra blob output; throws if the binding was not registered |

## Run the sample function app

1. Copy the example settings file and fill in storage values:

```bash
cp local.settings.json.example local.settings.json
```

2. Build and start:

```bash
npm run build
npm start
```

Optional environment overrides (also usable in `local.settings.json` → `Values`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `BLOB_TRIGGER_SOURCE_CONTAINER` | `incoming` | Source container for the blob trigger |
| `BLOB_TRIGGER_DEST_CONTAINER` | `processed` | Destination container for outputs |
| `BLOB_TRIGGER_CONNECTION` | `AzureWebJobsStorage` | App setting name for the connection string |

Upload a `.txt`, `.log`, or `.csv` blob into the source container; the sample writes `{path}-Copy.{ext}` into the destination container. Other extensions are logged and skipped.

## Scripts

| Script | Description |
| --- | --- |
| `npm run build` | Clean and compile TypeScript to `dist/` |
| `npm run watch` | Incremental compile |
| `npm start` | Build then `func start` (requires Core Tools) |
| `npm test` | Run Jest unit tests |
| `npm run test:cov` | Tests with coverage |
| `npm run lint` | Typecheck library and tests |

## Project layout

```
src/
  index.ts          # Public library exports
  functions.ts      # Azure Functions sample entry (package "main")
  blob.trigger.ts   # Fluent BlobTrigger builder
  blob.payload.ts   # Event / response types
tests/              # Jest suites
host.json           # Functions host configuration
```

## License

[MIT](./LICENSE) © Muryllo Pimenta de Oliveira
