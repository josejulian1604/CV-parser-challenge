import type { NormalizedResumeData } from "@/lib/extraction/schema/normalized";
import type { ExperienceEntry, EducationEntry } from "@/lib/extraction/schema/resume";
import { MissingFieldIndicator } from "@/components/shared/missing-field-indicator";

interface ResumePortfolioProps {
  data: NormalizedResumeData;
}

// The "// LABEL" eyebrow is the one recurring motif tying this design to the
// candidate's actual profession (a software engineer) without costuming the
// whole page as a fake terminal. break-after-avoid keeps it glued to
// whatever comes right after it — see architecture.md's "Print export
// constraints" for why this is scoped to the label, not the whole section.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs tracking-widest text-pine uppercase print:break-after-avoid">
      {`// ${children}`}
    </p>
  );
}

function formatDateRange(dateRange: {
  start: { raw: string } | null;
  end: { raw: string } | null;
  isCurrent: boolean;
}): string {
  const start = dateRange.start?.raw ?? "—";
  const end = dateRange.isCurrent ? "Present" : dateRange.end?.raw ?? "—";
  return `${start} — ${end}`;
}

function ExperienceItem({ entry }: { entry: ExperienceEntry }) {
  return (
    <div className="print:break-inside-avoid">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="font-semibold">{entry.title}</p>
        <p className="font-mono text-xs text-muted whitespace-nowrap">
          {formatDateRange(entry.dateRange)}
        </p>
      </div>
      <p className="text-muted text-sm">
        {entry.company}
        {entry.location ? ` · ${entry.location}` : ""}
      </p>
      {entry.bullets.length > 0 && (
        <ul className="mt-2 list-disc list-inside space-y-1 marker:text-pine">
          {entry.bullets.map((bullet, i) => (
            <li key={i} className="text-sm">
              {bullet}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EducationItem({ entry }: { entry: EducationEntry }) {
  return (
    <div className="print:break-inside-avoid">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="font-semibold">
          {entry.degree ?? <MissingFieldIndicator />}
          {entry.fieldOfStudy ? `, ${entry.fieldOfStudy}` : ""}
        </p>
        <p className="font-mono text-xs text-muted whitespace-nowrap">
          {formatDateRange(entry.dateRange)}
        </p>
      </div>
      <p className="text-muted text-sm">{entry.institution}</p>
    </div>
  );
}

export function ResumePortfolio({ data }: ResumePortfolioProps) {
  const { contact } = data;

  return (
    <article className="bg-paper text-ink max-w-2xl mx-auto px-8 py-10 space-y-8">
      <header className="print:break-inside-avoid">
        <h1 className="text-3xl font-bold tracking-tight">
          {contact.fullName ?? <MissingFieldIndicator />}
        </h1>
        <p className="mt-2 font-mono text-sm text-muted">
          {contact.email ?? <MissingFieldIndicator />}
          {contact.phone ? ` · ${contact.phone}` : ""}
        </p>
        <p className="font-mono text-sm text-muted">
          {[contact.location, contact.linkedin, contact.github, contact.website]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
        <hr className="mt-4 border-t border-pine" />
      </header>

      {data.summary && (
        <section className="print:break-inside-avoid">
          <SectionLabel>Summary</SectionLabel>
          <p className="mt-2 leading-relaxed">{data.summary}</p>
        </section>
      )}

      {data.experience.length > 0 && (
        <section>
          <SectionLabel>Experience</SectionLabel>
          <div className="mt-2 space-y-5">
            {data.experience.map((entry, i) => (
              <ExperienceItem key={i} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {data.education.length > 0 && (
        <section>
          <SectionLabel>Education</SectionLabel>
          <div className="mt-2 space-y-4">
            {data.education.map((entry, i) => (
              <EducationItem key={i} entry={entry} />
            ))}
          </div>
        </section>
      )}

      {data.skills.length > 0 && (
        <section className="print:break-inside-avoid">
          <SectionLabel>Skills</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.skills.map((skill, i) => (
              <span
                key={i}
                className="font-mono text-xs bg-pine-soft text-ink rounded px-2 py-1"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      {data.additionalSections.map((section, i) => (
        <section key={i}>
          <SectionLabel>{section.title}</SectionLabel>
          <div className="mt-2 space-y-3">
            {section.items.map((item, j) => (
              <p
                key={j}
                className="border-l-2 border-hairline pl-3 text-sm leading-relaxed print:break-inside-avoid"
              >
                {item}
              </p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
