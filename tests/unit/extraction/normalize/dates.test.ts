import { describe, expect, it } from "vitest";
import {
  normalizeDate,
  normalizeDateRange,
  sortExperienceByRecency,
} from "../../../../lib/extraction/normalize/dates";
import type { ExperienceEntry } from "../../../../lib/extraction/schema/resume";
import type { PartialDate } from "../../../../lib/extraction/schema/date";

function date(raw: string, year: number, month: number | null): PartialDate {
  return { raw, year, month };
}

describe("normalizeDate", () => {
  it('parses "March 2020"', () => {
    expect(normalizeDate(date("March 2020", 1999, null))).toEqual(date("March 2020", 2020, 3));
  });

  it('parses Spanish "Marzo 2020"', () => {
    expect(normalizeDate(date("Marzo 2020", 1999, null))).toEqual(date("Marzo 2020", 2020, 3));
  });

  it("parses accented Spanish month names", () => {
    expect(normalizeDate(date("Enero 2019", 1999, null))).toEqual(date("Enero 2019", 2019, 1));
  });

  it('parses "03/2020"', () => {
    expect(normalizeDate(date("03/2020", 1999, null))).toEqual(date("03/2020", 2020, 3));
  });

  it('parses single-digit month "3/2020"', () => {
    expect(normalizeDate(date("3/2020", 1999, null))).toEqual(date("3/2020", 2020, 3));
  });

  it('parses ISO-ish "2020-03"', () => {
    expect(normalizeDate(date("2020-03", 1999, null))).toEqual(date("2020-03", 2020, 3));
  });

  it('parses a bare year "2020"', () => {
    expect(normalizeDate(date("2020", 1999, 5))).toEqual(date("2020", 2020, null));
  });

  it("parses an abbreviated month with a trailing period", () => {
    expect(normalizeDate(date("Mar. 2020", 1999, null))).toEqual(date("Mar. 2020", 2020, 3));
  });

  it("is case-insensitive on month names", () => {
    expect(normalizeDate(date("MARCH 2020", 1999, null))).toEqual(date("MARCH 2020", 2020, 3));
  });

  it("leaves year/month untouched for an unparseable raw string", () => {
    const input = date("Sometime in the spring", 2020, 4);
    expect(normalizeDate(input)).toEqual(input);
  });

  it("leaves year/month untouched for an empty raw string", () => {
    const input = date("", 2020, 4);
    expect(normalizeDate(input)).toEqual(input);
  });

  it("leaves year/month untouched when the parsed year is out of bounds", () => {
    const input = date("March 1800", 2020, 4);
    expect(normalizeDate(input)).toEqual(input);
  });

  it("leaves year/month untouched when the parsed month is out of bounds", () => {
    const input = date("13/2020", 2020, 4);
    expect(normalizeDate(input)).toEqual(input);
  });

  it("leaves year/month untouched when an ISO-ish month is out of bounds", () => {
    const input = date("2020-13", 2020, 4);
    expect(normalizeDate(input)).toEqual(input);
  });

  it("leaves year/month untouched for an unrecognized month name", () => {
    const input = date("Zortember 2020", 2020, 4);
    expect(normalizeDate(input)).toEqual(input);
  });

  it("never modifies raw, even when it reparses year/month", () => {
    const result = normalizeDate(date("  March 2020  ", 1999, null));
    expect(result.raw).toBe("  March 2020  ");
  });

  it("is a no-op when raw already matches the LLM's year/month", () => {
    const input = date("March 2020", 2020, 3);
    expect(normalizeDate(input)).toEqual(input);
  });
});

describe("normalizeDateRange", () => {
  it("normalizes both start and end", () => {
    const result = normalizeDateRange({
      start: date("March 2020", 1999, null),
      end: date("2020-06", 1999, null),
      isCurrent: false,
    });
    expect(result.start).toEqual(date("March 2020", 2020, 3));
    expect(result.end).toEqual(date("2020-06", 2020, 6));
  });

  it("leaves null start/end as null", () => {
    const result = normalizeDateRange({ start: null, end: null, isCurrent: true });
    expect(result).toEqual({ start: null, end: null, isCurrent: true });
  });
});

function entry(overrides: Partial<ExperienceEntry> = {}): ExperienceEntry {
  return {
    company: "Acme",
    title: "Engineer",
    location: null,
    bullets: [],
    dateRange: { start: null, end: null, isCurrent: false },
    ...overrides,
  };
}

describe("sortExperienceByRecency", () => {
  it("returns an empty array unchanged", () => {
    expect(sortExperienceByRecency([])).toEqual([]);
  });

  it("sorts most-recent start date first", () => {
    const older = entry({
      company: "Older",
      dateRange: { start: date("2015", 2015, null), end: null, isCurrent: false },
    });
    const newer = entry({
      company: "Newer",
      dateRange: { start: date("2020", 2020, null), end: null, isCurrent: false },
    });
    expect(sortExperienceByRecency([older, newer]).map((e) => e.company)).toEqual([
      "Newer",
      "Older",
    ]);
  });

  it("is a no-op when already sorted most-recent-first", () => {
    const newer = entry({
      company: "Newer",
      dateRange: { start: date("2020", 2020, null), end: null, isCurrent: false },
    });
    const older = entry({
      company: "Older",
      dateRange: { start: date("2015", 2015, null), end: null, isCurrent: false },
    });
    expect(sortExperienceByRecency([newer, older]).map((e) => e.company)).toEqual([
      "Newer",
      "Older",
    ]);
  });

  it("treats isCurrent entries as most recent regardless of start date", () => {
    const current = entry({
      company: "Current",
      dateRange: { start: date("2018", 2018, null), end: null, isCurrent: true },
    });
    const newerButPast = entry({
      company: "Past",
      dateRange: { start: date("2021", 2021, null), end: date("2022", 2022, null), isCurrent: false },
    });
    expect(sortExperienceByRecency([newerButPast, current]).map((e) => e.company)).toEqual([
      "Current",
      "Past",
    ]);
  });

  it("sorts entries with no known start date last", () => {
    const unknown = entry({ company: "Unknown", dateRange: { start: null, end: null, isCurrent: false } });
    const known = entry({
      company: "Known",
      dateRange: { start: date("2015", 2015, null), end: null, isCurrent: false },
    });
    expect(sortExperienceByRecency([unknown, known]).map((e) => e.company)).toEqual([
      "Known",
      "Unknown",
    ]);
  });

  it("preserves original relative order for entries tied on the same month", () => {
    const a = entry({
      company: "A",
      dateRange: { start: date("March 2020", 2020, 3), end: null, isCurrent: false },
    });
    const b = entry({
      company: "B",
      dateRange: { start: date("March 2020", 2020, 3), end: null, isCurrent: false },
    });
    expect(sortExperienceByRecency([a, b]).map((e) => e.company)).toEqual(["A", "B"]);
  });

  // isCurrent entries both hit the +Infinity sentinel (recencyKey(b) -
  // recencyKey(a) is NaN for this pair). Verified this doesn't actually
  // regress without the explicit tie-check in sortExperienceByRecency —
  // Array.sort treats a NaN comparator result the same as 0 (both fail
  // `< 0` and `> 0`), so this test documents the tie case rather than
  // guarding against an observable bug.
  it("preserves original relative order for two isCurrent entries", () => {
    const a = entry({
      company: "A",
      dateRange: { start: date("2018", 2018, null), end: null, isCurrent: true },
    });
    const b = entry({
      company: "B",
      dateRange: { start: date("2019", 2019, null), end: null, isCurrent: true },
    });
    expect(sortExperienceByRecency([a, b]).map((e) => e.company)).toEqual(["A", "B"]);
  });

  it("preserves original relative order for two entries with no known start date", () => {
    const a = entry({ company: "A", dateRange: { start: null, end: null, isCurrent: false } });
    const b = entry({ company: "B", dateRange: { start: null, end: null, isCurrent: false } });
    expect(sortExperienceByRecency([a, b]).map((e) => e.company)).toEqual(["A", "B"]);
  });
});
