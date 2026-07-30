import type { ExperienceEntry } from "@/lib/extraction/schema/resume";
import { SectionWatermark } from "./section-watermark";
import { formatDateRange } from "./format-date";
import type { UiContent } from "./content";

interface ExperienceSectionProps {
  entries: ExperienceEntry[];
  lang: "en" | "es";
  content: UiContent;
}

// Timeline (vertical line + accent dot) is justified here specifically
// because employment history is the one genuinely chronological section
// (docs/Design-guidance.md §4) — not extended to education or skills.
export function ExperienceSection({ entries, lang, content }: ExperienceSectionProps) {
  if (entries.length === 0) return null;

  return (
    <section className="relative mb-16 last-of-type:mb-0">
      <SectionWatermark word={content.experience.toUpperCase()} />
      <div className="relative z-10 pt-[60px]">
        {/* break-after-avoid on BOTH header lines — see about-section.tsx
            for why a break is still legal after just the eyebrow if the
            italic title below it isn't covered too. */}
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent print:break-after-avoid">
          {content.experience}
        </p>
        <p className="mb-6 font-voice text-2xl italic text-ink print:break-after-avoid">
          {content.experience}
        </p>

        {/* Plain block flow, not flex-column — this list must be free to
            split between entries across as many printed pages as needed. */}
        <div className="border-l border-line pl-6">
          {entries.map((entry, i) => {
            const { text: dateText, title: dateTitle } = formatDateRange(
              entry.dateRange,
              lang,
              content
            );
            return (
              <div
                key={i}
                className="relative pb-9 last:pb-0 print:break-inside-avoid"
              >
                <span className="absolute -left-[27px] top-1.5 h-2 w-2 rounded-full bg-accent" />
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <p className="font-head text-base font-bold text-ink">
                    {entry.title} · <span className="font-medium text-accent">{entry.company}</span>
                  </p>
                  <span
                    className="whitespace-nowrap font-mono text-[11px] text-muted"
                    title={dateTitle || undefined}
                  >
                    {dateText}
                  </span>
                </div>
                {entry.location && (
                  <p className="mb-2.5 mt-0.5 text-xs text-muted">{entry.location}</p>
                )}
                {entry.bullets.length > 0 && (
                  <ul className="list-disc space-y-1 pl-[18px] text-[13.5px] leading-[1.65] text-ink marker:text-accent">
                    {entry.bullets.map((bullet, j) => (
                      <li key={j}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
