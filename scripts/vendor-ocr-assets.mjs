import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'public');

async function copy(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(resolve(root, source), resolve(root, destination), { recursive: true });
}

await mkdir(publicDir, { recursive: true });
await copy('node_modules/tesseract.js/dist/worker.min.js', 'public/tesseract/worker.min.js');
await copy('node_modules/tesseract.js-core', 'public/tesseract-core');
await rm(resolve(publicDir, 'tesseract-core/package.json'), { force: true });
await rm(resolve(publicDir, 'tesseract-core/README.md'), { force: true });
await rm(resolve(publicDir, 'tesseract-core/LICENSE'), { force: true });
await rm(resolve(publicDir, 'tesseract-core/index.js'), { force: true });
await copy(
  'node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz',
  'public/tessdata/eng.traineddata.gz',
);
await copy('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'public/pdfjs/pdf.worker.min.mjs');
await copy('node_modules/pdfjs-dist/cmaps', 'public/pdfjs/cmaps');
await copy('node_modules/pdfjs-dist/standard_fonts', 'public/pdfjs/standard_fonts');
await copy('node_modules/pdfjs-dist/wasm', 'public/pdfjs/wasm');
