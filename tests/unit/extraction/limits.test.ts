import { describe, expect, it } from "vitest";
import { truncateToPageLimit } from "../../../lib/extraction/limits";
import type { SourceDoc } from "../../../lib/extraction/adapters/types";

function doc(pageCount: number, blocks: SourceDoc["blocks"], text: string): SourceDoc {
  return { kind: "pdf", text, blocks, pageCount };
}

describe("truncateToPageLimit", () => {
  it("returns the document unchanged when pageCount is within the limit", () => {
    const input = doc(
      2,
      [
        { start: 0, end: 5, page: 1, isHeading: false },
        { start: 5, end: 10, page: 2, isHeading: false },
      ],
      "aaaaabbbbb"
    );
    const result = truncateToPageLimit(input, 3);
    expect(result).toEqual({ text: "aaaaabbbbb", truncated: false });
  });

  it("returns the document unchanged when pageCount equals the limit exactly", () => {
    const input = doc(3, [{ start: 0, end: 5, page: 3, isHeading: false }], "aaaaa");
    const result = truncateToPageLimit(input, 3);
    expect(result).toEqual({ text: "aaaaa", truncated: false });
  });

  it("truncates text to the last block within the page limit", () => {
    const input = doc(
      5,
      [
        { start: 0, end: 5, page: 1, isHeading: false },
        { start: 5, end: 10, page: 2, isHeading: false },
        { start: 10, end: 15, page: 3, isHeading: false },
        { start: 15, end: 20, page: 4, isHeading: false },
        { start: 20, end: 25, page: 5, isHeading: false },
      ],
      "aaaaabbbbbcccccdddddeeeee"
    );
    const result = truncateToPageLimit(input, 3);
    expect(result).toEqual({ text: "aaaaabbbbbccccc", truncated: true });
  });

  it("handles out-of-order blocks by using the max end offset within the limit", () => {
    const input = doc(
      5,
      [
        { start: 10, end: 15, page: 3, isHeading: false },
        { start: 0, end: 5, page: 1, isHeading: false },
        { start: 5, end: 10, page: 2, isHeading: false },
        { start: 15, end: 20, page: 4, isHeading: false },
      ],
      "aaaaabbbbbcccccddddd"
    );
    const result = truncateToPageLimit(input, 3);
    expect(result).toEqual({ text: "aaaaabbbbbccccc", truncated: true });
  });

  it("returns an empty string when no blocks fall within the page limit", () => {
    const input = doc(5, [{ start: 0, end: 5, page: 4, isHeading: false }], "aaaaa");
    const result = truncateToPageLimit(input, 3);
    expect(result).toEqual({ text: "", truncated: true });
  });

  it("is a no-op for a single-page document (e.g. DOCX) even with a low limit", () => {
    const input = doc(1, [{ start: 0, end: 5, page: 1, isHeading: false }], "aaaaa");
    const result = truncateToPageLimit(input, 3);
    expect(result).toEqual({ text: "aaaaa", truncated: false });
  });
});
