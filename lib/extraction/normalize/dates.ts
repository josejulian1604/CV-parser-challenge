import type { ExperienceEntry } from "../schema/resume";
import type { DateRange, PartialDate } from "../schema/date";

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  ene: 1,
  enero: 1,
  feb: 2,
  february: 2,
  febrero: 2,
  mar: 3,
  march: 3,
  marzo: 3,
  apr: 4,
  april: 4,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  june: 6,
  junio: 6,
  jul: 7,
  july: 7,
  julio: 7,
  aug: 8,
  august: 8,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  september: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  october: 10,
  octubre: 10,
  nov: 11,
  november: 11,
  noviembre: 11,
  dec: 12,
  december: 12,
  dic: 12,
  diciembre: 12,
};

// Mirrors PartialDateSchema's own year bounds (schema/date.ts) — kept as
// plain constants here rather than introspected from the Zod schema, since
// Zod v4's internal check representation isn't a stable public API to read.
const MIN_YEAR = 1950;
const MAX_YEAR = 2100;

function inBounds(year: number, month: number | null): boolean {
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  if (month !== null && (month < 1 || month > 12)) return false;
  return true;
}

// Matching-only normalization: strips accents and trailing punctuation so
// "Marzo 2020," and "marzo 2020" both match the same pattern. `raw` in the
// returned PartialDate is always the untouched original — grounding needs
// the literal source text.
function foldForMatching(raw: string): string {
  return raw
    .trim()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[.,]+$/, "")
    .trim();
}

function tryParse(folded: string): { year: number; month: number | null } | null {
  const slashMatch = /^(\d{1,2})\/(\d{4})$/.exec(folded);
  if (slashMatch) {
    return { month: Number(slashMatch[1]), year: Number(slashMatch[2]) };
  }

  const isoMatch = /^(\d{4})-(\d{1,2})$/.exec(folded);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]) };
  }

  const monthNameMatch = /^([a-z]+)\.?\s+(\d{4})$/i.exec(folded);
  if (monthNameMatch) {
    const month = MONTH_NAMES[monthNameMatch[1].toLowerCase()];
    if (month !== undefined) {
      return { month, year: Number(monthNameMatch[2]) };
    }
  }

  const yearOnlyMatch = /^(\d{4})$/.exec(folded);
  if (yearOnlyMatch) {
    return { year: Number(yearOnlyMatch[1]), month: null };
  }

  return null;
}

// Re-derives year/month from `raw` independently of what the LLM already
// produced, overwriting only when confidently parsed. An unparseable or
// out-of-bounds raw string leaves the LLM's own year/month untouched rather
// than replacing it with a guess.
export function normalizeDate(date: PartialDate): PartialDate {
  const parsed = tryParse(foldForMatching(date.raw));
  if (!parsed || !inBounds(parsed.year, parsed.month)) {
    return date;
  }
  return { ...date, year: parsed.year, month: parsed.month };
}

export function normalizeDateRange(dateRange: DateRange): DateRange {
  return {
    ...dateRange,
    start: dateRange.start ? normalizeDate(dateRange.start) : null,
    end: dateRange.end ? normalizeDate(dateRange.end) : null,
  };
}

function recencyKey(entry: ExperienceEntry): number {
  if (entry.dateRange.isCurrent) return Infinity;
  const start = entry.dateRange.start;
  if (!start) return -Infinity;
  return start.year * 12 + (start.month ?? 0);
}

// Array.prototype.sort is spec-stable since ES2019, so entries tied on
// recencyKey keep their original relative order — a no-op when the LLM
// already emitted most-recent-first. Two isCurrent entries (or two with no
// known start) both hit the same Infinity/-Infinity sentinel, making
// recencyKey(b) - recencyKey(a) evaluate to NaN — harmless here only because
// every conforming sort implementation checks the comparator's sign via
// `< 0`/`> 0`, and NaN fails both exactly like 0 does, so it's already
// treated as "no preference." The explicit equality check below doesn't
// change that runtime behavior; it's here so the tie case reads as
// intentional instead of as a NaN a future reader has to reason about.
export function sortExperienceByRecency(experience: ExperienceEntry[]): ExperienceEntry[] {
  return [...experience].sort((a, b) => {
    const keyA = recencyKey(a);
    const keyB = recencyKey(b);
    return keyA === keyB ? 0 : keyB - keyA;
  });
}
