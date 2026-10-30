import { describe, expect, it } from 'vitest';
import { hasExtractablePdfText } from './receipt-ocr';

describe('PDF text extraction threshold', () => {
  it('uses embedded text at 20 non-whitespace characters and OCRs shorter pages', () => {
    expect(hasExtractablePdfText('12345678901234567890')).toBe(true);
    expect(hasExtractablePdfText('1234567890 123456789')).toBe(false);
  });
});
