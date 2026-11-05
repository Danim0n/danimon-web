# Invoice OCR demo

Direct pages: `/demo/facturas/` (EN), `/es/demo/facturas/` (ES).

The fixed fictitious invoice is an authored SVG rasterised to PNG. The OCR receives
only PNG bytes, never the SVG text, page labels or expected answers. Tesseract.js
7.0.0 runs its LSTM-only engine in a dedicated browser worker. The engine, worker
and quantised English model are served from `public/invoice-ocr/`; no CDN request
or remote inference occurs at runtime. Worker and model load only on explicit
activation. English character recognition also handles the Spanish sample.

`src/scripts/invoice-demo/ocr.ts` owns the pinned worker protocol directly so it can
terminate the worker on failed initialisation, abort, timeout, navigation and success.
The source rectangles and confidences come from Tesseract's actual word output.
`extract.ts` applies simple parsing rules after OCR, with no expected-answer fallback.

Saving is explicit and uses only `danimon.invoice-demo.review.v1` in localStorage.
The review includes the original OCR, evidence boxes and original/edited values.
Storage failure still allows downloading the JSON. No file picker or upload exists.

Rebuild bundled assets with `node tools/invoice-demo/prepare-assets.mjs` after `npm ci`.
The script copies the pinned installed distributions and creates a SHA-256 manifest.
It downloads the pinned model only if it is missing. Generated third-party JS gets
an initial `@ts-nocheck` comment to avoid checking vendor output as project source.

Sources / licences:
- https://github.com/naptha/tesseract.js (worker, 7.0.0, Apache-2.0)
- https://github.com/naptha/tesseract.js-core (WASM core, 7.0.0, Apache-2.0)
- https://github.com/naptha/tessdata (English 4.0.0_best_int language data,
  Apache-2.0 upstream, distributed as `@tesseract.js-data/eng@1.0.0`, whose
  package metadata declares MIT)

The WASM is embedded in the three `*.wasm.js` core variants. Only the compatible
variant is fetched (~3.9 MB), alongside the worker (~111 KB) and model (~2.95 MB).
Fallback: the static image and selectable transcript work without JavaScript.
