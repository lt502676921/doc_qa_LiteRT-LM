# Document test fixtures

The five bundled PDFs total 3,433,721 bytes (about 3.27 MiB). Original author credits and rights notices remain in each PDF. `UPSTREAM-LICENSE.txt` preserves the fixture collection's license notice, and the original paper sources are listed below.

These files support development tests and the home page's **Try a built-in document** selector. Users can also upload their own files. Both the development server and production build include the five examples, adding about 3.27 MiB to the deployment. Each PDF loads only when selected.

| File | Pages | Main checks | Original source |
| --- | ---: | --- | --- |
| [bitcoin.pdf](bitcoin.pdf) | 9 | Short document answers, evidence across sections, privacy, text and visual limits | [Bitcoin](https://bitcoin.org/bitcoin.pdf) |
| [attention.pdf](attention.pdf) | 15 | Numerical evidence, model architecture, table and formula extraction | [arXiv](https://arxiv.org/pdf/1706.03762) |
| [gfs.pdf](gfs.pdf) | 15 | Long document budgets, two-column order, parameters, control and data paths | [Google Research](https://static.googleusercontent.com/media/research.google.com/en//archive/gfs-sosp2003.pdf) |
| [mapreduce.pdf](mapreduce.pdf) | 13 | Two-column order, pseudocode, failure recovery, comparisons across sections | [Google Research](https://static.googleusercontent.com/media/research.google.com/en//archive/mapreduce-osdi04.pdf) |
| [raft.pdf](raft.pdf) | 18 | Long document budgets, reasoning across sections, elections and configuration changes | [Raft](https://raft.github.io/raft.pdf) |

All page references use physical PDF pages, starting at 1. These can differ from printed page numbers.

## Automated parsing checks

Run from the project directory:

```sh
pnpm test:papers
```

The script uses the installed `officeparser` package with OCR and attachment extraction disabled. It checks:

- File sizes and SHA-256 hashes against the original fixture baselines.
- PDF page counts, contiguous physical page numbers and readable text on every page.
- Known evidence on the expected pages, such as GFS's `64 MB` and `60 seconds`.
- Minimum extracted Markdown lengths, allowing normal layout differences without requiring exact text equality.
- Document associations, reference page ranges and evidence coverage requirements in the QA cases.

This command verifies file integrity and parsing in Node.js. It does not download a model or run inference, and it does not verify the browser worker, GPU execution or generated answers.

## Browser answer checks

[qa-cases.json](qa-cases.json) contains 17 English questions and review criteria covering facts, evidence across sections, missing information and questions requiring visual input. Test Bitcoin first, followed by Attention, MapReduce, GFS and Raft.

The [manual QA checklist](MANUAL-QA-EN.md) provides the corresponding English questions, expected answers, checked source excerpts and PDF page references. Its detailed structured companion is [qa-cases.en.json](qa-cases.en.json). These describe acceptance criteria; they do not record successful model runs.

For each question, record the model and context settings, reading range, answer, citations, time to first token, total duration and any cancellation or failure:

| Case ID | Settings and reading range | Facts correct | Supported by source | Citation locates source | Limits stated correctly | First token / total time | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| bitcoin-privacy | | | | | | | |

Judge the meaning of `expectedPoints`, without requiring identical wording. `referencePages` are checked starting points, not an exhaustive list of valid sources. Cases that compare sections must also satisfy `minimumDistinctEvidencePages`; citing only an abstract does not support a comparison across sections.

For missing information, the answer should state that the document does not provide it and avoid filling gaps with outside knowledge. If only selected excerpts were supplied, the absence claim must be limited to those excerpts.

For visual questions, the answer must disclose that the model receives extracted text only. Extracting a figure caption or labels does not mean the model has observed colors, arrows or spatial relationships. The original PDF viewer is available to the reader, but its rendered pages are not model input.

The application tracks physical PDF pages, supports clickable source references, budgets context and selects relevant excerpts. Long summaries process batches and report coverage. Citation validation checks that source IDs belong to the supplied input; a reviewer must still check whether the original text supports the claims. Reporting that a document exceeds the context budget can be correct behavior.

## Fixture coverage limits

These are well-known English papers that a model may have seen during training. A correct answer alone does not prove that it read the supplied file. Check each citation against the evidence actually provided in that run.

Use [the synthetic upload fixture](../text-only-smoke.md) to check unfamiliar facts and missing information. Future fixtures can add facts at the beginning, middle and end of a document, as well as Office files, scanned pages and mixed PDFs. The paper suite does not cover these formats or replace checks on real devices.

Passing automated parsing checks does not guarantee correct reading order, formulas or tables. Extracted MapReduce and Raft text can interleave columns; compare it with the original PDF in the browser.
