import {
  GlobalWorkerOptions,
  getDocument,
  type PDFDocumentProxy,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Result } from "../result";

let configured = false;

// The "legacy" build (not the standard browser build) is required here: the
// standard build assumes DOM globals (DOMMatrix, etc.) that don't exist in
// Node, which breaks `npx vitest run`. The legacy build works in both
// browsers and Node, so this doesn't compromise the browser-only intent.
//
// Worker path resolution differs by environment: `new URL(spec, import.meta.url)`
// is a pattern webpack/Turbopack statically rewrite into a bundled asset URL
// at build time — required for the browser, but meaningless in plain Node
// (no bundler present), where `import.meta.resolve` performs real module
// resolution instead. Node-only execution happens under Vitest, never in
// production (this module is browser-only per architecture.md).
function configureWorker(): void {
  if (configured) return;
  GlobalWorkerOptions.workerSrc =
    typeof window === "undefined"
      ? import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs")
      : new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
  configured = true;
}

export type PdfLoadError = { kind: "pdf_load_failed"; cause: unknown };

export async function loadPdfDocument(
  file: File
): Promise<Result<PDFDocumentProxy, PdfLoadError>> {
  configureWorker();
  try {
    const data = await file.arrayBuffer();
    const doc = await getDocument({ data }).promise;
    return { ok: true, value: doc };
  } catch (cause) {
    return { ok: false, error: { kind: "pdf_load_failed", cause } };
  }
}
