import { describe, expect, it } from "vitest";
import { normalizeSkills } from "../../../../lib/extraction/normalize/skills";

describe("normalizeSkills", () => {
  it("returns already-clean, no-duplicate input unchanged", () => {
    expect(normalizeSkills(["Python", "AWS", "Docker"])).toEqual(["Python", "AWS", "Docker"]);
  });

  it("returns an empty array unchanged", () => {
    expect(normalizeSkills([])).toEqual([]);
  });

  it("drops blank/whitespace-only entries", () => {
    expect(normalizeSkills(["Python", "  ", "", "AWS"])).toEqual(["Python", "AWS"]);
  });

  it("dedupes case-insensitively, keeping the most common casing", () => {
    const result = normalizeSkills(["python", "Python", "PYTHON", "Python"]);
    expect(result).toEqual(["Python"]);
  });

  it("breaks a casing tie by first-seen order", () => {
    const result = normalizeSkills(["python", "Python"]);
    expect(result).toEqual(["python"]);
  });

  it("preserves order of first appearance across distinct skills", () => {
    const result = normalizeSkills(["SQL", "Python", "sql", "AWS"]);
    expect(result).toEqual(["SQL", "Python", "AWS"]);
  });

  it("trims surrounding whitespace before comparing", () => {
    const result = normalizeSkills([" Python", "Python "]);
    expect(result).toEqual(["Python"]);
  });
});
