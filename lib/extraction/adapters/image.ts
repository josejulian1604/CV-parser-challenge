import type { Result } from "../result";
import { loadPdfDocument, type PdfLoadError } from "./pdf-worker";

export interface RenderedImage {
  mediaType: "image/jpeg";
  data: string;
}

export type ImageAdapterError =
  | PdfLoadError
  | { kind: "no_pages" }
  | { kind: "page_render_failed"; page: number; cause: unknown }
  | { kind: "image_decode_failed"; cause: unknown }
  | { kind: "canvas_unavailable" }
  | { kind: "payload_too_large"; totalBytes: number };

// PDF's native unit is 72 DPI; rendering at 150 DPI keeps scanned text
// legible to the model without the multi-thousand-pixel canvases a print-
// resolution render would produce.
const PDF_BASE_DPI = 72;
const RENDER_DPI = 150;

// Anthropic's documented long-edge sweet spot — larger images get resized
// server-side anyway before the model ever sees them, so capping here saves
// upload bandwidth and client-side memory for no quality benefit.
const MAX_IMAGE_DIMENSION = 1568;

const JPEG_QUALITY = 0.82;

// Vercel Hobby's request body ceiling is ~4.5MB; capping well under that so
// an oversized payload fails with a clear error instead of a silent platform
// rejection upstream.
const MAX_TOTAL_PAYLOAD_BYTES = 4_000_000;

export function computeScaledDimensions(
  width: number,
  height: number,
  maxDimension: number
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function extractBase64FromDataUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

// Base64 inflates binary size by ~4/3 — approximating byte size from string
// length this way avoids decoding just to measure.
function base64ByteSize(base64: string): number {
  return Math.ceil((base64.length * 3) / 4);
}

export function checkTotalPayloadSize(
  images: RenderedImage[]
): Result<void, ImageAdapterError> {
  const totalBytes = images.reduce((sum, img) => sum + base64ByteSize(img.data), 0);
  if (totalBytes > MAX_TOTAL_PAYLOAD_BYTES) {
    return { ok: false, error: { kind: "payload_too_large", totalBytes } };
  }
  return { ok: true, value: undefined };
}

function canvasToRenderedImage(canvas: HTMLCanvasElement): RenderedImage {
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { mediaType: "image/jpeg", data: extractBase64FromDataUrl(dataUrl) };
}

function downscaleCanvas(source: HTMLCanvasElement, maxDimension: number): HTMLCanvasElement {
  const { width, height } = computeScaledDimensions(source.width, source.height, maxDimension);
  if (width === source.width && height === source.height) return source;

  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0, width, height);
  return target;
}

export async function renderScannedPdfToImages(
  file: File,
  maxPages: number
): Promise<Result<RenderedImage[], ImageAdapterError>> {
  const loaded = await loadPdfDocument(file);
  if (!loaded.ok) return loaded;

  const pdfDoc = loaded.value;
  if (pdfDoc.numPages === 0) {
    return { ok: false, error: { kind: "no_pages" } };
  }

  const pageCount = Math.min(pdfDoc.numPages, maxPages);
  const images: RenderedImage[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: RENDER_DPI / PDF_BASE_DPI });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return { ok: false, error: { kind: "canvas_unavailable" } };

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      images.push(canvasToRenderedImage(downscaleCanvas(canvas, MAX_IMAGE_DIMENSION)));
    } catch (cause) {
      return { ok: false, error: { kind: "page_render_failed", page: pageNum, cause } };
    }
  }

  const sizeCheck = checkTotalPayloadSize(images);
  if (!sizeCheck.ok) return sizeCheck;

  return { ok: true, value: images };
}

export async function compressImageFile(
  file: File
): Promise<Result<RenderedImage, ImageAdapterError>> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (cause) {
    return { ok: false, error: { kind: "image_decode_failed", cause } };
  }

  const { width, height } = computeScaledDimensions(
    bitmap.width,
    bitmap.height,
    MAX_IMAGE_DIMENSION
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: false, error: { kind: "canvas_unavailable" } };

  ctx.drawImage(bitmap, 0, 0, width, height);
  const image = canvasToRenderedImage(canvas);

  const sizeCheck = checkTotalPayloadSize([image]);
  if (!sizeCheck.ok) return sizeCheck;

  return { ok: true, value: image };
}
