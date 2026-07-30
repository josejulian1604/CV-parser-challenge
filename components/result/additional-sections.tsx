import type { AdditionalSection } from "@/lib/extraction/schema/resume";
import type { UiContent } from "./content";

interface AdditionalSectionsProps {
  sections: AdditionalSection[];
  content: UiContent;
}

// docs/Design-guidance.md §3: fully dynamic and open-ended — titles are
// never a fixed enum, never hardcoded as real logic. A single-line item and
// a long-paragraph item must both render correctly in the same list, so no
// truncation and no fixed height that could clip a long item.
//
// The mockup's .additional-grid uses `flex flex-direction:column` to stack
// these cards — the second violation flagged in the spec. Plain block flow
// + space-y instead, so the list stays free to split between cards (and
// between items within a card) across as many pages as needed.
export function AdditionalSections({ sections, content }: AdditionalSectionsProps) {
  if (sections.length === 0) return null;

  return (
    <section className="mb-16 last-of-type:mb-0">
      <p className="mb-6 font-mono text-xs uppercase tracking-widest text-accent print:break-after-avoid">
        {content.additional}
      </p>
      <div className="space-y-8">
        {sections.map((section, i) => (
          <div key={i}>
            <h3 className="mb-2.5 font-head text-xs font-bold uppercase tracking-wide text-accent print:break-after-avoid">
              {section.title}
            </h3>
            <ul className="space-y-1.5">
              {section.items.map((item, j) => (
                <li
                  key={j}
                  className="text-[13px] leading-[1.6] text-ink print:break-inside-avoid"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
