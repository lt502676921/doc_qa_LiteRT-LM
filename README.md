# Doc Q&A

A browser workspace for reading documents, asking questions and checking the original evidence. Document parsing and model inference run locally using LiteRT-LM and WebGPU. The interface, assistant instructions, documentation and test cases use English.

## Features

- Open PDF, DOCX, XLSX, PPTX, TXT, Markdown, JSON and CSV files.
- Try five built-in papers: Bitcoin, Attention Is All You Need, MapReduce, The Google File System and Raft.
- Ask questions about readable text and follow citations to the source. PDF references open the original page and highlight available source regions.
- Select a page, slide, sheet or section to limit the reading range.
- Use relevant excerpts when a document exceeds the context budget, or summarize the selected range in batches with coverage progress.
- Save documents, conversations and settings in browser storage, and reuse cached model weights.

## Requirements

- Node.js 20.19 or newer and pnpm. The project has been checked with Node.js 20.19.6 and pnpm 10.27.0.
- A browser with WebGPU and enough available GPU memory for the selected model.
- A secure browser context: localhost during development or HTTPS for deployment.
- Enough disk space for model weights. The default configured model is Gemma 4 E4B, with a listed download size of about 2.8 GB. A cached or local model can be reused.

## Run locally

From this directory:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the development URL shown in the terminal, normally `http://localhost:5173`.

1. Upload a document or choose **Try a built-in document**.
2. Review the reading range and model settings.
3. Ask a question or select **Summarize**. The application loads the configured model when needed.
4. Follow an answer's source references and compare the claims with the original text.

### Local model weights

To reuse an existing model file, place the matching `.litertlm` file in `models/`, such as `models/gemma-4-E4B-it-web.litertlm`. The loader checks the browser cache first, then probes the local server's `models/` directory before downloading the configured remote model. Loaded weights are cached in the browser when storage is available.

Model settings default to a context length of 16,384 tokens and an output reserve of 2,048 tokens. Increasing the context length increases memory requirements. Model weights are local development assets and are not bundled as portable deployment files.

## Checks

```sh
pnpm typecheck
pnpm test
pnpm build
```

| Command | What it checks |
| --- | --- |
| `pnpm typecheck` | TypeScript source and test files |
| `pnpm test:core` | Document extraction, source geometry, citations, context budgets, storage, session behavior and cancellation |
| `pnpm test:papers` | PDF integrity, parsing baselines and manual QA case metadata |
| `pnpm test` | Both core tests and paper fixture checks |
| `pnpm build` | Production compilation and runtime asset packaging |

The `*_test.ts` files beside components and stores contain Jasmine specifications. They are included in type checking; the current `pnpm test` command executes the Node.js core suite and paper checks, not these browser specifications.

Automated tests do not run real GPU model inference. Use the [paper fixture guide](test/fixtures/papers/README.md) and [manual browser QA checklist](test/fixtures/papers/MANUAL-QA-EN.md) to review generated answers. The [synthetic upload fixture](test/fixtures/text-only-smoke.md) provides unfamiliar facts and intentionally missing information.

## Build and serve

```sh
pnpm build
pnpm exec vite preview
```

The output is written to `dist/`. The build copies the built-in PDFs, PDF worker and viewer assets, and LiteRT-LM WebAssembly runtime. If local model files exist, the build creates symlinks in `dist/models/` for local preview. These links point outside `dist/`; exclude or replace them when preparing a portable deployment.

Serve production files over HTTPS with these response headers, which the development and preview servers already provide:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

## Data and reading limits

Document files, extracted text, conversation history, settings and cached weights stay in browser storage. The application uses the network to load its assets and uncached model weights; the page also requests fonts from Google Fonts. Browser storage is specific to the site origin and may be cleared or evicted.

The model receives extracted text. OCR and attachment extraction are disabled, so scanned pages, colors, arrows and other visual details are not available as evidence. Viewing the original PDF does not send its page images to the model. Multi-column reading order, formulas and tables may need manual review.

Context is limited. Answers based on selected excerpts must describe gaps in those excerpts without claiming that information is absent from the entire document. Citation validation confirms that a source ID was supplied, but it does not prove that every generated claim is supported.

## Project layout

```text
src/components/       Interface and document viewer
src/services/         Parsing, source geometry, citations, context and storage
src/stores/           Conversations, model loading and settings
src/styles/           Shared interface styles
public/               App manifest, service worker and icons
models/               Local model weights
scripts/              Paper fixture verification
test/                 Node.js core tests and document fixtures
vite.config.ts        Development headers and runtime asset packaging
```

Preserve the existing copyright and license notices in source files and bundled papers. The paper fixture collection's notice is in [UPSTREAM-LICENSE.txt](test/fixtures/papers/UPSTREAM-LICENSE.txt).
