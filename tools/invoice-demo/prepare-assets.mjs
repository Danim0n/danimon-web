// Rebuild only the demo's public assets. No paid API or remote inference.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import {fileURLToPath} from 'node:url';

const target = new URL('../../public/invoice-ocr/', import.meta.url);
await mkdir(target, { recursive: true });
const copies = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js/dist/worker.min.js.LICENSE.txt', 'worker.min.js.LICENSE.txt'],
  ['tesseract.js/LICENSE.md', 'TESSERACT-LICENSE.txt'],
  ['tesseract.js-core/LICENSE', 'CORE-LICENSE.txt'],
  ...['', '-simd', '-relaxedsimd'].map(feature => [
    `tesseract.js-core/tesseract-core${feature}-lstm.wasm.js`,
    `tesseract-core${feature}-lstm.wasm.js`,
  ]),
];
for (const [from, to] of copies) {
  await copyFile(new URL(`../../node_modules/${from}`, import.meta.url), new URL(to, target));
  if (to.endsWith('.js')) {
    const source = await readFile(new URL(to,target),'utf8');
    await writeFile(new URL(to,target),`// @ts-nocheck — third-party generated distribution; see adjacent licence.\n${source}`);
  }
}
const modelUrl = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz';
const modelFile = new URL('eng.traineddata.gz', target);
try { await readFile(modelFile); } catch {
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
  await writeFile(modelFile, new Uint8Array(await response.arrayBuffer()));
}
const manifest = { engine: 'tesseract.js@7.0.0', model: modelUrl, files: {} };
for (const file of [...copies.map(([, name]) => name), 'eng.traineddata.gz']) {
  const bytes = await readFile(new URL(file, target));
  manifest.files[file] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await writeFile(new URL('manifest.json', target), `${JSON.stringify(manifest, null, 2)}\n`);
await sharp(fileURLToPath(new URL('../../public/invoice-demo/factura-ficticia.svg', import.meta.url)))
  .png().toFile(fileURLToPath(new URL('../../public/invoice-demo/factura-ficticia.png', import.meta.url)));
console.log('Invoice image and local OCR assets prepared.');
