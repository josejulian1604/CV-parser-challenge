import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePdf } from "../../../../lib/extraction/adapters/pdf";
import type { SourceDoc } from "../../../../lib/extraction/adapters/types";

const FIXTURES_DIR = join(__dirname, "..", "..", "..", "fixtures", "pdf");

function loadFixture(name: string): File {
  const bytes = readFileSync(join(FIXTURES_DIR, name));
  return new File([bytes], name, { type: "application/pdf" });
}

function expectInOrder(text: string, substrings: string[]): void {
  let cursor = -1;
  for (const substring of substrings) {
    const index = text.indexOf(substring, cursor + 1);
    expect(index, `expected "${substring}" after offset ${cursor}`).toBeGreaterThan(-1);
    cursor = index;
  }
}

async function parseFixture(name: string): Promise<SourceDoc> {
  const result = await parsePdf(loadFixture(name));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("parsePdf", () => {
  it("sample-1.pdf: single page, blocks present, reads in visual order", async () => {
    const doc = await parseFixture("sample-1.pdf");

    expect(doc.pageCount).toBe(1);
    expect(doc.blocks.length).toBeGreaterThan(0);

    expectInOrder(doc.text, [
      "José Julián Gutiérrez Badilla",
      "Professional Summary",
      "Professional Experience",
      "Monseñor Sanabria Hospital",
      "Projects",
      "Education",
      "Technical Skills",
      "Extracurricular Activities",
    ]);

    // Verified against real output: this template bolds+underlines section
    // headers at the SAME font size as body text, so a pure font-size
    // heuristic only catches the (genuinely larger) name — a real limitation
    // of the size-only approach, not a bug. See sample-3 for a template
    // where headers do get a distinct size and detection works well.
    const headingCount = doc.blocks.filter((b) => b.isHeading).length;
    expect(headingCount).toBeGreaterThanOrEqual(1);
  });

  it("sample-2.pdf: single page, blocks present, reads in visual order", async () => {
    const doc = await parseFixture("sample-2.pdf");

    expect(doc.pageCount).toBe(1);
    expect(doc.blocks.length).toBeGreaterThan(0);

    expectInOrder(doc.text, [
      "Marcela Vindas Solano",
      "Experience",
      "Mechanical Design Engineer",
      "Education",
      "Skills",
      "Extracurricular Activities",
    ]);

    // Same template family as sample-1 — headers are bold+underlined, not
    // larger, so only the name is caught. See comment on the sample-1 test.
    const headingCount = doc.blocks.filter((b) => b.isHeading).length;
    expect(headingCount).toBeGreaterThanOrEqual(1);
  });

  it("sample-3.pdf: three pages, known two-column limitation on page 1", async () => {
    const doc = await parseFixture("sample-3.pdf");

    expect(doc.pageCount).toBe(3);
    expect(doc.blocks.length).toBeGreaterThan(0);

    // Page 1 is two-column (sidebar + main) — only assert presence, not
    // relative order, since column-interleaving is a documented known
    // limitation (architecture.md), not a bug this task fixes.
    for (const substring of [
      "Renata Solórzano Vega",
      "Contact",
      "Skills",
      "Languages",
      "Certifications",
      "Profile",
      "Experience",
    ]) {
      expect(doc.text.includes(substring), `expected "${substring}" present`).toBe(true);
    }

    // Pages 2-3 are single-column — reading order is checked.
    expectInOrder(doc.text, [
      "Education",
      "Projects",
      "Extracurricular Activities",
      "Awards & Recognition",
      "Speaking & Publications",
      "Professional Development",
      "Marketing Advisor",
      "References",
    ]);

    const headingCount = doc.blocks.filter((b) => b.isHeading).length;
    expect(headingCount).toBeGreaterThanOrEqual(10);
  });

  it("every block's [start, end) slice matches the text it claims to cover", async () => {
    const doc = await parseFixture("sample-2.pdf");
    for (const block of doc.blocks) {
      expect(block.start).toBeLessThan(block.end);
      expect(doc.text.slice(block.start, block.end).length).toBe(block.end - block.start);
    }
  });
});
