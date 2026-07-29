import type { Result } from "../result";
import { loadPdfDocument, type PdfLoadError } from "./pdf-worker";

export type ExtractionRoute = "pdf-with-text" | "pdf-scanned" | "docx" | "image";

export interface ClassifiedDoc {
  route: ExtractionRoute;
  file: File;
}

export type ClassifyError =
  | { kind: "unrecognized_file_type"; name: string; type: string }
  | PdfLoadError
  | {
      kind: "route_not_implemented";
      route: Exclude<ExtractionRoute, "pdf-with-text" | "docx">;
    };

// Scanned PDFs have no text layer (or a near-empty one); text-based resumes
// comfortably clear this even on a single sparse page. See architecture.md
// Stage 1.
const MIN_AVG_CHARS_PER_PAGE = 100;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function classifyDocument(
  file: File
): Promise<Result<ClassifiedDoc, ClassifyError>> {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    return classifyPdf(file);
  }

  if (type === DOCX_MIME || name.endsWith(".docx")) {
    return { ok: true, value: { route: "docx", file } };
  }

  if (type.startsWith("image/")) {
    return { ok: false, error: { kind: "route_not_implemented", route: "image" } };
  }

  return {
    ok: false,
    error: { kind: "unrecognized_file_type", name: file.name, type },
  };
}

async function classifyPdf(file: File): Promise<Result<ClassifiedDoc, ClassifyError>> {
  const loaded = await loadPdfDocument(file);
  if (!loaded.ok) return loaded;

  const pdfDoc = loaded.value;
  let totalChars = 0;
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ("str" in item) totalChars += item.str.length;
    }
  }

  const avgCharsPerPage = totalChars / pdfDoc.numPages;
  if (avgCharsPerPage >= MIN_AVG_CHARS_PER_PAGE) {
    return { ok: true, value: { route: "pdf-with-text", file } };
  }

  return { ok: false, error: { kind: "route_not_implemented", route: "pdf-scanned" } };
}
