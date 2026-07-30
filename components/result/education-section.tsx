import type { EducationEntry } from "@/lib/extraction/schema/resume";
import { formatDateRange } from "./format-date";
import type { UiContent } from "./content";

interface EducationSectionProps {
  entries: EducationEntry[];
  lang: "en" | "es";
  content: UiContent;
}

function degreeLine(entry: EducationEntry): string | null {
  if (entry.degree && entry.fieldOfStudy) return `${entry.degree}, ${entry.fieldOfStudy}`;
  return entry.degree ?? entry.fieldOfStudy ?? null;
}

// The mockup's .edu-grid uses `flex flex-direction:column` to stack these
// entries — flagged in docs/Design-guidance.md as a violation of its own
// §2/§5 rule (a container whose height can span multiple printed pages
// must not be Grid/Flexbox). Plain block flow + divide-y instead, visually
// identical, no top-level flex.
export function EducationSection({ entries, lang, content }: EducationSectionProps) {
  if (entries.length === 0) return null;

  return (
    <section className="mb-16 last-of-type:mb-0">
      <p className="mb-6 font-mono text-xs uppercase tracking-widest text-accent print:break-after-avoid">
        {content.education}
      </p>
      <div className="divide-y divide-line">
        {entries.map((entry, i) => {
          const { text: dateText, title: dateTitle } = formatDateRange(
            entry.dateRange,
            lang,
            content
          );
          const degree = degreeLine(entry);
          return (
            <div
              key={i}
              className="flex flex-wrap items-baseline justify-between gap-4 py-4 first:pt-0 last:pb-0 print:break-inside-avoid"
            >
              <div>
                <p className="font-head text-sm font-bold text-ink">{entry.institution}</p>
                {degree && <p className="text-xs text-muted">{degree}</p>}
              </div>
              <span
                className="whitespace-nowrap font-mono text-[11px] text-muted"
                title={dateTitle || undefined}
              >
                {dateText}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
