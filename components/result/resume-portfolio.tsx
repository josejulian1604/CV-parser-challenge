import type { NormalizedContact, NormalizedResumeData } from "@/lib/extraction/schema/normalized";
import { getContent } from "./content";
import { AboutSection } from "./about-section";
import { ExperienceSection } from "./experience-section";
import { EducationSection } from "./education-section";
import { SkillsSection } from "./skills-section";
import { AdditionalSections } from "./additional-sections";

interface ResumePortfolioProps {
  data: NormalizedResumeData;
}

// GitHub/LinkedIn/website values may arrive as a bare handle or a full URL
// depending on how the source resume wrote them — this avoids rendering a
// dead href when only a handle was extracted.
function toHref(value: string, base: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${base}${value.replace(/^\/+/, "")}`;
}

function ContactItem({
  href,
  valid,
  children,
}: {
  href?: string;
  valid?: boolean;
  children: React.ReactNode;
}) {
  // docs/Design-guidance.md §3: a present-but-invalid email/phone is still
  // shown (never hide data that was found) but isn't wired as a link, and
  // gets a visually distinct (dotted) underline so it reads as "found,
  // unverified" rather than fully trusted.
  if (href && valid !== false) {
    return (
      <a
        href={href}
        className="text-ink underline decoration-line decoration-solid underline-offset-[3px] hover:decoration-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {children}
      </a>
    );
  }
  if (valid === false) {
    return <span className="underline decoration-dotted decoration-muted underline-offset-[3px]">{children}</span>;
  }
  return <span>{children}</span>;
}

function ContactRow({ contact }: { contact: NormalizedContact }) {
  const items: React.ReactNode[] = [];

  if (contact.email) {
    items.push(
      <ContactItem
        key="email"
        href={contact.isEmailValid ? `mailto:${contact.email}` : undefined}
        valid={contact.isEmailValid}
      >
        {contact.email}
      </ContactItem>
    );
  }
  if (contact.phone) {
    items.push(
      <ContactItem
        key="phone"
        href={contact.isPhoneValid ? `tel:${contact.phone}` : undefined}
        valid={contact.isPhoneValid}
      >
        {contact.phone}
      </ContactItem>
    );
  }
  if (contact.location) {
    items.push(<span key="location">{contact.location}</span>);
  }
  if (contact.github) {
    items.push(
      <ContactItem key="github" href={toHref(contact.github, "github.com/")}>
        {contact.github}
      </ContactItem>
    );
  }
  if (contact.linkedin) {
    items.push(
      <ContactItem key="linkedin" href={toHref(contact.linkedin, "linkedin.com/in/")}>
        {contact.linkedin}
      </ContactItem>
    );
  }
  if (contact.website) {
    items.push(
      <ContactItem key="website" href={toHref(contact.website, "")}>
        {contact.website}
      </ContactItem>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 font-body text-[13px] text-muted [&>*:not(:last-child)]:after:ml-3.5 [&>*:not(:last-child)]:after:text-line [&>*:not(:last-child)]:after:content-['·']">
      {items}
    </div>
  );
}

export function ResumePortfolio({ data }: ResumePortfolioProps) {
  const content = getContent(data.detectedLanguage);
  const { contact } = data;
  const roleLine = data.experience[0]?.title;

  return (
    <article className="relative mx-auto max-w-[820px] bg-paper px-14 py-20 text-ink sm:px-14 max-sm:px-6 max-sm:py-14">
      <header className="relative">
        {/* Decorative diagonal lines: scoped to this small header wrapper
            only (not the whole document), so overflow:hidden here can never
            clip paginated content — there is none inside this wrapper. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden print:hidden max-sm:hidden">
          <div className="absolute right-[-90px] top-9 w-[340px] rotate-[28deg] border-t border-line" />
          <div className="absolute bottom-[-40px] left-[-110px] w-[280px] -rotate-[24deg] border-t border-line" />
        </div>

        <div className="relative z-10">
          <p className="mb-3.5 font-mono text-xs uppercase tracking-widest text-accent">
            {content.eyebrow}
          </p>
          <h1 className="mb-2.5 font-head text-[clamp(40px,7vw,68px)] font-bold uppercase leading-[0.98] tracking-tight text-ink">
            {contact.fullName ?? content.nameUnavailable}
          </h1>
          {roleLine && (
            <p className="mb-7 font-mono text-[13px] text-muted">{roleLine}</p>
          )}
          <ContactRow contact={contact} />
        </div>
      </header>

      <hr className="my-12 h-px border-0 bg-line" />

      <AboutSection summary={data.summary} content={content} />
      <ExperienceSection
        entries={data.experience}
        lang={data.detectedLanguage}
        content={content}
      />
      <EducationSection
        entries={data.education}
        lang={data.detectedLanguage}
        content={content}
      />
      <SkillsSection skills={data.skills} content={content} />
      <AdditionalSections sections={data.additionalSections} content={content} />

      <footer className="mt-16 border-t border-line pt-6 font-mono text-[11px] text-muted">
        {contact.fullName ?? content.nameUnavailable}
        {contact.email ? ` · ${contact.email}` : ""}
      </footer>
    </article>
  );
}
