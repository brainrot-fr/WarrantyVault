import { describe, expect, it } from 'vitest';
import { convertPixelsToGrayscale, getScaledDimensions } from './image-preprocessing';

describe('OCR image preprocessing', () => {
  it('keeps small images and caps the long edge at 2000 pixels', () => {
    expect(getScaledDimensions(1000, 800)).toEqual({ width: 1000, height: 800 });
    expect(getScaledDimensions(4000, 2000)).toEqual({ width: 2000, height: 1000 });
    expect(getScaledDimensions(1000, 4000)).toEqual({ width: 500, height: 2000 });
  });

  it('rejects invalid image dimensions', () => {
    expect(() => getScaledDimensions(0, 20)).toThrow('positive finite numbers');
  });

  it('converts pixels to grayscale while preserving alpha', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 77, 0, 255, 0, 128]);
    convertPixelsToGrayscale(pixels);
    expect(Array.from(pixels)).toEqual([76, 76, 76, 77, 150, 150, 150, 128]);
  });
});
