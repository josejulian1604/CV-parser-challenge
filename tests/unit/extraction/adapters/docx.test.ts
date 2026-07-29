import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDocx } from "../../../../lib/extraction/adapters/docx";
import type { SourceDoc } from "../../../../lib/extraction/adapters/types";

const FIXTURES_DIR = join(__dirname, "..", "..", "..", "fixtures", "docx");
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function loadFixture(name: string): File {
  const bytes = readFileSync(join(FIXTURES_DIR, name));
  return new File([bytes], name, { type: DOCX_MIME });
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
  const result = await parseDocx(loadFixture(name));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("parseDocx", () => {
  it("sample-1.docx: reads in order, headings detected from Heading 1 style", async () => {
    const doc = await parseFixture("sample-1.docx");

    expect(doc.pageCount).toBe(1);
    expect(doc.blocks.length).toBeGreaterThan(0);
    for (const block of doc.blocks) expect(block.page).toBe(1);

    expectInOrder(doc.text, [
      "Andrés Fonseca Rojas",
      "PROFILE",
      "EXPERIENCE",
      "EDUCATION",
      "SKILLS",
      "CERTIFICATIONS",
    ]);

    // Matches the fixture's real Heading1 paragraph count (verified against
    // word/styles.xml) — every section header in this template gets the
    // style, so detection is exact here, unlike the PDF route's size-only
    // heuristic.
    const headingCount = doc.blocks.filter((b) => b.isHeading).length;
    expect(headingCount).toBe(5);
  });

  it("sample-2.docx: reads in order, headings detected from Heading 1 style", async () => {
    const doc = await parseFixture("sample-2.docx");

    expect(doc.pageCount).toBe(1);
    expect(doc.blocks.length).toBeGreaterThan(0);

    expectInOrder(doc.text, [
      "Camila Herrera Monge",
      "ABOUT",
      "EXPERIENCE",
      "EDUCATION",
      "SKILLS",
      "SELECTED PROJECTS",
    ]);

    const headingCount = doc.blocks.filter((b) => b.isHeading).length;
    expect(headingCount).toBe(5);
  });

  it("sample-3.docx: reads in order, headings detected from Heading 1 style", async () => {
    const doc = await parseFixture("sample-3.docx");

    expect(doc.pageCount).toBe(1);
    expect(doc.blocks.length).toBeGreaterThan(0);

    expectInOrder(doc.text, [
      "Tomás Herrera Quesada",
      "SUMMARY",
      "CORE COMPETENCIES",
      "EXPERIENCE",
      "TECHNICAL SKILLS",
      "EDUCATION",
      "SELECTED PROJECTS",
      "PUBLICATIONS & TALKS",
      "CERTIFICATIONS",
    ]);

    const headingCount = doc.blocks.filter((b) => b.isHeading).length;
    expect(headingCount).toBe(8);
  });

  it("returns docx_load_failed for a file that isn't a valid docx zip", async () => {
    const file = new File(["not a real docx"], "broken.docx", { type: DOCX_MIME });
    const result = await parseDocx(file);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("docx_load_failed");
    }
  });

  it("every block's [start, end) slice matches the text it claims to cover", async () => {
    const doc = await parseFixture("sample-2.docx");
    for (const block of doc.blocks) {
      expect(block.start).toBeLessThan(block.end);
      expect(doc.text.slice(block.start, block.end).length).toBe(block.end - block.start);
    }
  });
});
