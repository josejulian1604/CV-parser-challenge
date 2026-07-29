import type { SourceDoc } from "./adapters/types";

export interface TruncationResult {
  text: string;
  truncated: boolean;
}

// Adapters append blocks in page order as they build doc.text (see pdf.ts,
// docx.ts), so the highest `end` offset among blocks on an allowed page is a
// safe cut point — no separate per-page offset index needed.
export function truncateToPageLimit(doc: SourceDoc, maxPages: number): TruncationResult {
  if (doc.pageCount <= maxPages) {
    return { text: doc.text, truncated: false };
  }

  let cutoff = 0;
  for (const block of doc.blocks) {
    if (block.page <= maxPages && block.end > cutoff) {
      cutoff = block.end;
    }
  }

  return { text: doc.text.slice(0, cutoff), truncated: true };
}
