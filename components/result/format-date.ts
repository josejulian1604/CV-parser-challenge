import type { DateRange, PartialDate } from "@/lib/extraction/schema/date";
import type { UiContent } from "./content";

const MONTH_ABBR: Record<"en" | "es", string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};

function formatPartialDate(date: PartialDate, lang: "en" | "es"): string {
  if (date.month === null) return String(date.year);
  return `${MONTH_ABBR[lang][date.month - 1]} ${date.year}`;
}

export interface FormattedDateRange {
  text: string;
  /** The original as-written date text, for a title="" tooltip — the
   * parsed year/month can lose information (e.g. "Spring 2021"). */
  title: string;
}

// docs/Design-guidance.md §3's date rules: year-only stays year-only (never
// fabricate a month), isCurrent always renders localized "Present" and never
// a specific end date, and a genuinely unknown end (isCurrent: false, no
// end) must never be asserted as "Present" — it gets its own honest string.
export function formatDateRange(
  dateRange: DateRange,
  lang: "en" | "es",
  content: UiContent
): FormattedDateRange {
  const startText = dateRange.start ? formatPartialDate(dateRange.start, lang) : null;

  const endText = dateRange.isCurrent
    ? content.present
    : dateRange.end
      ? formatPartialDate(dateRange.end, lang)
      : content.endUnspecified;

  const text = startText ? `${startText} — ${endText}` : endText;
  const title = [dateRange.start?.raw, dateRange.end?.raw].filter(Boolean).join(" — ");

  return { text, title };
}
