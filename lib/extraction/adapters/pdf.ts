import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Result } from "../result";
import { loadPdfDocument, type PdfLoadError } from "./pdf-worker";
import type { Block, SourceDoc } from "./types";

export type PdfAdapterError =
  | PdfLoadError
  | { kind: "no_pages" }
  | { kind: "page_text_extraction_failed"; page: number; cause: unknown };

// Sub-line jitter (kerning, superscripts) is typically well under a third of
// the font's own size, while distinct lines are spaced at least a full
// line-height apart — this ratio separates the two without per-document
// calibration.
const Y_BAND_TOLERANCE_RATIO = 0.3;

// Below this fraction of the median glyph height, a gap between two items on
// the same line is treated as normal kerning/style-change spacing rather
// than a word boundary.
const SPACE_GAP_RATIO = 0.15;

// Body text has natural size noise up to ~10% (rounding, kerning-driven
// metrics); resume section headers are typically a clear size jump, not a
// marginal one. 1.2 sits above the noise floor while still catching real
// headers.
const HEADING_SIZE_RATIO = 1.2;

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function toPositionedItem(item: TextItem): PositionedItem | null {
  if (!item.str) return null;
  const [, , c, d, e, f] = item.transform;
  const height = item.height || Math.abs(d);
  return { str: item.str, x: e, y: f, width: item.width, height };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function groupIntoLines(items: PositionedItem[], yTolerance: number): PositionedItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y);
  const lines: PositionedItem[][] = [];
  for (const item of sorted) {
    const currentLine = lines[lines.length - 1];
    if (currentLine && Math.abs(item.y - currentLine[0].y) <= yTolerance) {
      currentLine.push(item);
    } else {
      lines.push([item]);
    }
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x);
  return lines;
}

export async function parsePdf(file: File): Promise<Result<SourceDoc, PdfAdapterError>> {
  const loaded = await loadPdfDocument(file);
  if (!loaded.ok) return loaded;

  const pdfDoc = loaded.value;
  if (pdfDoc.numPages === 0) {
    return { ok: false, error: { kind: "no_pages" } };
  }

  const pages: { page: number; items: PositionedItem[] }[] = [];
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    try {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const items: PositionedItem[] = [];
      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const positioned = toPositionedItem(raw);
        if (positioned) items.push(positioned);
      }
      pages.push({ page: pageNum, items });
    } catch (cause) {
      return { ok: false, error: { kind: "page_text_extraction_failed", page: pageNum, cause } };
    }
  }

  const allHeights = pages.flatMap((p) => p.items.map((i) => i.height)).filter((h) => h > 0);
  const medianHeight = median(allHeights);
  const yTolerance = Math.max(1, medianHeight * Y_BAND_TOLERANCE_RATIO);
  const spaceGap = medianHeight * SPACE_GAP_RATIO;

  let text = "";
  const blocks: Block[] = [];

  for (const { page, items } of pages) {
    const lines = groupIntoLines(items, yTolerance);
    for (const line of lines) {
      for (let i = 0; i < line.length; i++) {
        const item = line[i];
        if (i > 0) {
          const prev = line[i - 1];
          const gap = item.x - (prev.x + prev.width);
          if (gap > spaceGap) text += " ";
        }
        const start = text.length;
        text += item.str;
        const end = text.length;
        blocks.push({
          start,
          end,
          page,
          isHeading: item.height > medianHeight * HEADING_SIZE_RATIO,
          bbox: { x: item.x, y: item.y, w: item.width, h: item.height },
        });
      }
      text += "\n";
    }
  }

  return {
    ok: true,
    value: { kind: "pdf", text, blocks, pageCount: pdfDoc.numPages },
  };
}
