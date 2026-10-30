export function getScaledDimensions(
  width: number,
  height: number,
  maximumEdge = 2000,
) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(maximumEdge) ||
    width <= 0 ||
    height <= 0 ||
    maximumEdge <= 0
  ) {
    throw new Error('Image dimensions must be positive finite numbers.');
  }
  const scale = Math.min(1, maximumEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function convertPixelsToGrayscale(pixels: Uint8ClampedArray) {
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = Math.round(
      pixels[index] * 0.299 +
        pixels[index + 1] * 0.587 +
        pixels[index + 2] * 0.114,
    );
    pixels[index] = gray;
    pixels[index + 1] = gray;
    pixels[index + 2] = gray;
  }
}
