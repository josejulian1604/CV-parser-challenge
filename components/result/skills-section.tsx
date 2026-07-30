import type { UiContent } from "./content";

interface SkillsSectionProps {
  skills: string[];
  content: UiContent;
}

// docs/Design-guidance.md §3: empty skills list → omit the whole section,
// label included, not an empty chip row.
export function SkillsSection({ skills, content }: SkillsSectionProps) {
  if (skills.length === 0) return null;

  return (
    <section className="mb-16 last-of-type:mb-0">
      <p className="mb-6 font-mono text-xs uppercase tracking-widest text-accent print:break-after-avoid">
        {content.skills}
      </p>
      {/* A single wrapping row of short chips — small bounded component,
          the explicit exception to the no-top-level-flex rule. */}
      <ul className="flex flex-wrap gap-2">
        {skills.map((skill, i) => (
          <li
            key={i}
            className="rounded-sm border border-line px-2.5 py-1.5 font-mono text-xs text-muted"
          >
            {skill}
          </li>
        ))}
      </ul>
    </section>
  );
}
