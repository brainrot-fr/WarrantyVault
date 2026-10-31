import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { hasExtractablePdfText } from './receipt-ocr';

describe('PDF text extraction threshold', () => {
  it('uses embedded text at 20 non-whitespace characters and OCRs shorter pages', () => {
    expect(hasExtractablePdfText('12345678901234567890')).toBe(true);
    expect(hasExtractablePdfText('1234567890 123456789')).toBe(false);
  });

  describe('vendored OCR assets', () => {
    it('contains every asset path referenced by the receipt OCR pipeline', () => {
      const requiredPaths = [
        'public/tesseract/worker.min.js',
        'public/tesseract-core',
        'public/tessdata/eng.traineddata.gz',
        'public/pdfjs/pdf.worker.min.mjs',
        'public/pdfjs/cmaps',
        'public/pdfjs/standard_fonts',
        'public/pdfjs/wasm',
      ];

      for (const path of requiredPaths) {
        expect(existsSync(resolve(process.cwd(), path)), `${path} is missing`).toBe(true);
      }
    });
  });
});
