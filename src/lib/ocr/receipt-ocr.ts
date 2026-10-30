import { copy } from '@/lib/copy';
import type { ValidatedReceipt } from '@/features/receipts/receipt-validation';
import { convertPixelsToGrayscale, getScaledDimensions } from './image-preprocessing';

export interface OcrProgress {
  phase: 'preparing' | 'reading' | 'complete';
  percent: number;
}

export interface OcrResult {
  text: string;
  source: 'pdf-text' | 'ocr';
}

function reportProgress(
  callback: ((progress: OcrProgress) => void) | undefined,
  phase: OcrProgress['phase'],
  percent: number,
) {
  callback?.({ phase, percent: Math.min(100, Math.max(0, Math.round(percent))) });
}

function canvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error(copy.receiptOcrError);
  return context;
}

function grayscaleCanvas(canvas: HTMLCanvasElement) {
  const context = canvasContext(canvas);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  convertPixelsToGrayscale(pixels.data);
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export function hasExtractablePdfText(text: string) {
  return text.replace(/\s/g, '').length >= 20;
}

async function prepareImage(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const dimensions = getScaledDimensions(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    canvasContext(canvas).drawImage(bitmap, 0, 0, dimensions.width, dimensions.height);
    return grayscaleCanvas(canvas);
  } finally {
    bitmap.close();
  }
}

async function readPdf(file: File): Promise<{ text: string; canvas?: HTMLCanvasElement }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdfjs/pdf.worker.min.mjs`;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${window.location.origin}/pdfjs/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${window.location.origin}/pdfjs/standard_fonts/`,
    wasmUrl: `${window.location.origin}/pdfjs/wasm/`,
  });
  const pdfDocument = await loadingTask.promise;
  try {
    const page = await pdfDocument.getPage(1);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item): item is typeof item & { str: string } => 'str' in item)
      .map((item) => item.str)
      .join(' ');
    if (hasExtractablePdfText(text)) return { text };

    const viewportAtScaleOne = page.getViewport({ scale: 1 });
    const dimensions = getScaledDimensions(
      viewportAtScaleOne.width,
      viewportAtScaleOne.height,
    );
    const scale = dimensions.width / viewportAtScaleOne.width;
    const viewport = page.getViewport({ scale });
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({
      canvas,
      canvasContext: canvasContext(canvas),
      viewport,
    }).promise;
    return { text, canvas: grayscaleCanvas(canvas) };
  } finally {
    await loadingTask.destroy();
  }
}

export async function recognizeReceipt(
  receipt: ValidatedReceipt,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrResult> {
  let canvas: HTMLCanvasElement | undefined;
  try {
    reportProgress(onProgress, 'preparing', 5);
    let pdfText: string | null = null;
    if (receipt.format === 'pdf') {
      const pdf = await readPdf(receipt.file);
      pdfText = pdf.text;
      canvas = pdf.canvas;
      if (!canvas) {
        reportProgress(onProgress, 'complete', 100);
        return { text: pdfText ?? '', source: 'pdf-text' };
      }
    } else {
      canvas = await prepareImage(receipt.file);
    }

    const { createWorker } = await import('tesseract.js');
    const assetUrl = (path: string) => `${window.location.origin}${path}`;
    const worker = await createWorker('eng', 1, {
      corePath: assetUrl('/tesseract-core/'),
      langPath: assetUrl('/tessdata'),
      workerPath: assetUrl('/tesseract/worker.min.js'),
      gzip: true,
      logger: ({ progress }) => reportProgress(onProgress, 'reading', progress * 90 + 10),
    });
    try {
      const result = await worker.recognize(canvas);
      reportProgress(onProgress, 'complete', 100);
      return {
        text: result.data.text || pdfText || '',
        source: 'ocr',
      };
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    throw new Error(copy.receiptOcrError, { cause: error });
  }
}
