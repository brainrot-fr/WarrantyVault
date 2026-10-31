import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'src/lib/ocr/receipt-ocr.ts'), 'utf8');
const paths = [...source.matchAll(/assetUrl\(['"]([^'"]+)['"]\)/g)]
  .map((match) => match[1]);
const required = new Set([
  '/tesseract-core/tesseract-core-simd-lstm.wasm.js',
  '/tesseract-core/tesseract-core-simd-lstm.wasm',
  '/tessdata/eng.traineddata.gz',
  '/tesseract/worker.min.js',
  '/pdfjs/pdf.worker.min.mjs',
  '/pdfjs/cmaps',
  '/pdfjs/standard_fonts',
  '/pdfjs/wasm',
  ...paths,
]);

for (const path of required) {
  const destination = resolve(root, 'dist', path.replace(/^\/+/, ''));
  if (!existsSync(destination)) {
    throw new Error(`Missing OCR build asset: ${path} (${destination})`);
  }
  if (!path.endsWith('/') && statSync(destination).isFile() && statSync(destination).size === 0) {
    throw new Error(`OCR build asset is empty: ${path}`);
  }
}
