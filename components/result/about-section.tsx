import { SectionWatermark } from "./section-watermark";
import type { UiContent } from "./content";

interface AboutSectionProps {
  summary: string | null;
  content: UiContent;
}

// docs/Design-guidance.md §3: summary absent → omit the entire section,
// including its watermark. No placeholder sentence — absence is a common,
// expected case per the schema, not an error to paper over.
export function AboutSection({ summary, content }: AboutSectionProps) {
  if (!summary) return null;

  return (
    <section className="relative mb-16 last-of-type:mb-0">
      <SectionWatermark word={content.about.toUpperCase()} />
      <div className="relative z-10 pt-[60px]">
        {/* break-after-avoid on BOTH header lines, not just the eyebrow: a
            break is still legal immediately after the eyebrow if only that
            line is protected, which orphaned the header from its content in
            testing — the constraint has to cover every line up to the
            content that follows it. */}
        <p className="mb-1 font-mono text-xs uppercase tracking-widest text-accent print:break-after-avoid">
          {content.about}
        </p>
        <p className="mb-6 font-voice text-2xl italic text-ink print:break-after-avoid">
          {content.about}
        </p>
        <p className="max-w-[640px] font-body text-[15px] leading-[1.75] text-ink">{summary}</p>
      </div>
    </section>
  );
}
