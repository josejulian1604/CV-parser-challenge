# Design guidance — Resume/Portfolio page

This document is the implementation spec for the chosen design direction
(dark editorial portfolio). It assumes the reader has also read:

- `lib/extraction/schema/resume.ts` — the exact shape of the data this
  page renders (this replaces a standalone `resume-data-shape.md` that
  was consolidated into the real schema — the schema is the source of
  truth, not a separate doc that can drift from it).
- `docs/architecture.md`'s "Print export constraints" section — why
  this page uses `window.print()` / `@media print` instead of a
  server-side PDF renderer, and which CSS patterns break pagination
  (this replaces a standalone `print-export-considerations.md`, same
  consolidation reasoning as above).
- `design-reference/portfolio-mockup-v3.html` — the visual reference
  this spec describes. Use it as the source of truth for markup
  structure, tokens, and visual behavior — translate it into the
  project's stack, don't restyle from scratch. This file is gitignored
  (local reference only, not part of the shipped app) — read it
  directly from disk.
  NOTE: the mockup itself has two spots that violate this spec's own
  §2/§5 rules — `.edu-grid` and `.additional-grid` use
  `display:flex; flex-direction:column` to stack a full list of
  entries. Do NOT carry that over — use plain block flow with
  margin-bottom/space-y spacing instead (visually identical, same fix
  already applied to `.exp-list`-style patterns in this codebase
  before). Every other flex usage in the mockup (contact row, a single
  experience/education entry's internal header row) is a small bounded
  component and is fine as-is.
  Also verify explicitly during the print test whether `.page`'s
  `overflow:hidden` (used to clip the two decorative diagonal lines)
  causes any content clipping across page breaks — it likely doesn't
  since `.page` has no fixed height, but confirm rather than assume.

**Design direction in one line:** a dark, editorial, single-page portfolio
— bold uppercase sans for identity, an italic serif used sparingly as an
accent voice, oversized outline watermark words behind the two most
identity-heavy sections, a single warm gold accent, no buttons, and a
white/ink print fallback so the same page can be sent as a PDF.

---

## 0. Stack

- **Framework**: Next.js (App Router assumed unless the project says
  otherwise).
- **Language**: TypeScript — every component takes a typed prop matching
  the shapes in `lib/extraction/schema/resume.ts` (contact, summary,
  experience[], education[], skills[], additionalSections[]). Define
  these as shared interfaces/types once, reuse across components —
  don't inline object shapes per component.
- **Styling**: Tailwind CSS. Custom values (the palette, the two custom
  fonts, the watermark technique) don't map to default Tailwind utilities,
  so they need to be registered as first-class theme values rather than
  reached for as one-off arbitrary values scattered through JSX. See §1.
- **Existing `globals.css`**: the project already has one. Inspect it
  before adding anything — extend it, match its existing conventions
  (naming, layer usage, whether it already defines CSS custom properties
  for something else), and don't duplicate `@tailwind` directives or
  reset rules it already has. Add the new tokens and the `@media print`
  block as an addition, not a replacement.

---

## 1. Design tokens

### Screen palette
```
--paper:      #14151A   page background
--ink:        #ECEAE3   primary text
--muted:      #97948C   secondary/meta text
--line:       #2B2C31   hairlines, dividers, watermark stroke
--accent:     #D7A34E   labels, links (hover), timeline dots, company name
--accent-ink: #1C1610   text-on-accent (reserved, not currently used on a filled surface)
```

### Print palette (same variable names, overridden inside `@media print`)
```
--paper:      #FFFFFF
--ink:        #181818
--muted:      #5A5A5A
--line:       #DEDEDE
--accent:     #8A5A1E   darkened for legibility/ink economy on white
--accent-ink: #FFFFFF
```

**How to wire this into Tailwind:** define the tokens as CSS custom
properties in `globals.css` (`:root { --paper: ...; }` plus a `@media
print { :root { --paper: ...; } }` override block), then register them in
`tailwind.config.ts` under `theme.extend.colors` (e.g. `paper:
'var(--paper)'`, `ink: 'var(--ink)'`, etc.) so components use
`bg-paper`, `text-ink`, `text-muted`, `border-line`, `text-accent`
utilities — never hardcoded hex values inside components, and never
inline `style={{ color: '#D7A34E' }}`. This keeps the print override a
pure token swap with zero component changes, which is the same mechanism
the reference mockup uses with raw CSS variables.

### Typography
| Role | Face | Weights used | Where |
|---|---|---|---|
| `font-head` | Space Grotesk | 500, 700 | name (h1), experience role, education institution |
| `font-voice` | Fraunces (italic) | 400 italic | section titles only — used sparingly, never for body copy |
| `font-body` | Inter | 400, 500 | paragraphs, contact row |
| `font-mono` | IBM Plex Mono | 400, 500 | eyebrow, section labels, all dates |

Load all four via `next/font/google`, expose each as a CSS variable
(`variable: '--font-head'`, etc.) on the root layout, and register those
variable names in `tailwind.config.ts` under `theme.extend.fontFamily` so
components use `font-head`, `font-voice`, `font-body`, `font-mono`
utility classes. This avoids a manual `<link>` to Google Fonts (which is
what the standalone HTML mockup uses, since it isn't a Next.js app) and
gets Next's automatic font optimization for free.

Type scale: hero name `clamp(40px,7vw,68px)` / 700 / uppercase; section
title 26px / 400 italic; role/institution 16px / 700; body/about text 15px
/ line-height 1.75; bullets 13.5px / line-height 1.65; mono labels & dates
11–13px. Express these as Tailwind arbitrary values or as named entries
in `theme.extend.fontSize` if they'll be reused across more than one
component.

Vertical rhythm: sections separated by 64px margin; page padding 80px/56px
desktop, 56px/24px mobile; the divider under the hero has 48px margin top
and bottom.

---

## 2. Layout structure

The entire document is **single-column block flow** — no top-level Grid or
Flexbox anywhere in the page structure (this means no `flex`/`grid`
Tailwind classes on the containers that wrap the whole page, a whole
section, or a whole list of repeated entries — they're fine for small
bounded components like a single entry's internal header row or the
contact-info line, just not for anything that stacks a variable-length
list of entries across the page). This is deliberate: per
`docs/architecture.md`'s print constraints, Grid/Flexbox containers whose
height must span multiple printed pages paginate unreliably. Plain block
flow paginates correctly with zero special handling.

Section order, top to bottom:

1. **Header** — eyebrow, `<h1>` name, role line, contact row.
2. **Divider**.
3. **About** — *conditional*, see §3. Watermark word per §8's language rule.
4. **Experience** — always present. Watermark word per §8. Timeline
   pattern (vertical line + accent dot per entry).
5. **Education** — always present. No watermark (see §4 on restraint).
6. **Skills** — present whenever the skills list is non-empty.
7. **Additional** (`additionalSections`) — *conditional*, fully dynamic, see §3.
8. **Footer** — name + email, quiet, small.

Each section should be its own typed component
(`<AboutSection summary={...} />`, `<ExperienceSection entries={...} />`,
etc.) so the "omit if absent/empty" rules in §3 are enforced once, inside
the component, rather than re-implemented at every call site.

---

## 3. Data-to-design mapping — graceful degradation rules

This is the most important section. `lib/extraction/schema/resume.ts` is
explicit that an absent field is a **normal outcome**, not an error state
— every rule below exists so the implementation never has to improvise a
fallback under deadline pressure.

- **fullName absent** (rare, e.g. stylized letterhead resumes): never
  render an empty `<h1>`. Fall back to a neutral placeholder heading and
  flag this case to whoever owns the copy — don't silently guess a name.
- **email / phone absent**: omit that contact-row item entirely.
- **email / phone present but `isEmailValid`/`isPhoneValid` is false**:
  still display the value (never hide data that was found), but do not
  wire it as a `mailto:`/`tel:` link, and give it a visually distinct
  treatment (e.g. dotted instead of solid underline) so it reads as
  "found, unverified" rather than fully trusted.
- **location / linkedin / github / website absent**: each is independent;
  omit only that item. If *all* contact fields are absent, omit the whole
  contact-row rather than rendering an empty line.
- **summary absent**: omit the entire "About" section, including its
  watermark. Do not render an empty section, a placeholder sentence, or a
  "no summary provided" message — per the schema this is a common,
  expected case.
- **experience[].location absent**: omit that entry's location line.
- **experience[].bullets is an empty list**: omit the `<ul>` entirely for
  that entry — no empty bullet marker.
- **date ranges** (experience and education share this shape):
  - Year-only start/end → display the year only. Never fabricate a month.
  - Year+month → format as "MMM YYYY" (localized to the CV's detected
    language, see §8).
  - `isCurrent: true` → render the localized "Present"/"Presente" string.
    Never show a specific end date when this flag is true.
  - `isCurrent: false` and `end` present → format normally.
  - `isCurrent: false` and `end` absent (genuinely unknown) → render
    something honest like "end date not specified" (localized). **Never**
    render "Present"/"Presente" for an unknown end date — that asserts
    something false.
  - Keep the original raw string (e.g. "Spring 2021") available as a
    `title=""` tooltip — it can carry information the parsed year/month
    lost.
- **education[].degree / fieldOfStudy**: each renders independently; if
  both are absent, show institution + dates only, with no dangling
  separator punctuation.
- **skills is an empty list**: omit the whole Skills section (label
  included), don't render an empty chip row.
- **additionalSections**: fully dynamic. Titles are not a fixed enum —
  never hardcode section titles as real logic (they only appear as sample
  content in the mockup — "Certificaciones/Idiomas/Proyectos" there is
  just example data). Render whatever `title`/`items` pairs exist, in the
  order provided. A single-line item and a long-paragraph item must both
  render correctly in the same list — don't truncate, don't force a fixed
  height that would clip a long item (this matters for print too — see §5).
- **additionalSections is an empty list**: omit the whole section.

---

## 4. Signature elements — where the design spends its boldness

Per the frontend-design principle of restraint, this direction spends its
"bold" budget in exactly these places and nowhere else:

- **Oversized outline watermark word**, behind the About and Experience
  sections only (not every section — restraint). Implementation:
  transparent fill, `-webkit-text-stroke` in the `line` color, positioned
  absolutely inside a relatively-positioned section wrapper, behind the
  foreground content (`z-index`). Because the fill is transparent, it can
  never reduce legibility of the text in front of it — this is why it's
  safe to place behind real content instead of empty decorative space.
- **Two thin diagonal lines**, hero only, pure CSS (border + rotation) —
  no imagery. Hidden below the small-screen breakpoint and hidden in
  print (they're decorative-only, so dropping them costs nothing
  functionally). See the note at the top of this document about verifying
  `.page`'s `overflow:hidden` (used to clip these) doesn't affect print
  pagination.
- **Timeline** (vertical line + accent dot), experience entries only —
  justified because employment history is the one section that's
  genuinely chronological. Do not extend this device to education or
  skills.
- **One accent color**, used consistently for: eyebrow text, section
  labels, the company name inside each experience entry, timeline dots,
  and link hover states. Never introduce a second accent hue.

**Not for production**: the reference mockup includes a "print preview"
toggle button that swaps the palette via JavaScript, purely so it could be
demonstrated standalone. Don't implement that toggle in the real app —
the real print behavior should come entirely from `@media print` in CSS,
triggered by the browser's actual print dialog.

---

## 5. Print behavior

- No top-level Grid/Flexbox (§2 above) — the browser's default block-flow
  pagination handles this document correctly without help.
- `@media print` overrides only the CSS custom property *values* (§1's
  print palette) inside `globals.css` — component code never needs a
  print-specific rewrite, because everything already reads from the
  Tailwind color tokens that resolve to those variables.
- `print-color-adjust: exact` (with the `-webkit-` prefix) is set globally
  inside `@media print`, since the accent color and timeline dots are
  solid fills that would otherwise be silently dropped by the browser's
  default ink-saving behavior.
- The two decorative diagonal lines are hidden in print — zero functional
  loss.
- Watermark words stay visible in print. Because they're stroke-only with
  no fill, ink usage stays low, and they continue to function as
  oversized section headers rather than being purely decorative.
- `break-inside: avoid` on each **individual** experience entry, education
  entry, and each additional-section list item. **Never** on the outer
  list/grid containers themselves — those must stay free to split
  *between* entries across as many pages as needed.
- `break-after: avoid` on each section's label/title heading pair, so a
  heading is never orphaned at the bottom of a page, separated from its
  own content.
- No `position: sticky` / `position: fixed` anywhere — nothing in this
  design currently needs it, and it must stay that way.
- No `overflow: hidden` on any container that holds real content
  (bullets, additional-section items) — reserve it, if ever needed, for
  purely decorative layers only. See the top-of-document note about
  verifying this against `.page`'s existing usage in the mockup.

Tailwind's `print:` variant can be used for the handful of
show/hide-in-print utility toggles (e.g. `print:hidden` on the diagonal
lines), but the palette swap itself should stay in `globals.css` as a
plain `@media print` block overriding the custom properties, not as
per-component `print:` color classes.

---

## 6. Responsive behavior

- **≥640px**: as built in the reference file.
- **<640px**: page padding drops to 56px/24px; watermark font-size drops
  from 120px to 70px (verify it doesn't overflow its section for the
  longest word you actually use); diagonal lines are hidden entirely;
  rows using flex + space-between (experience header, education entries)
  must wrap rather than clip — dates should drop to their own line under
  the title rather than compressing. Use Tailwind's `sm:`/`md:` prefixes
  for these breakpoints, consistent with whatever breakpoint scale the
  project's `tailwind.config.ts` already defines.
- No horizontal scroll at any width; test down to 360px.

---

## 7. Accessibility baseline

- Use real semantic headings: promote section titles to actual `<h2>`
  elements, and keep `<h1>` reserved for the person's name.
- Visible keyboard focus on every link (contact row) — don't remove the
  default outline without an equally visible replacement (Tailwind's
  `focus-visible:` utilities).
- Verify color contrast for the `muted` token against `paper` in **both**
  palettes meets WCAG AA (4.5:1) at the font sizes used; adjust the token
  value if implementation testing shows it falling short.
- Wrap any motion beyond the existing background/color transition in a
  `prefers-reduced-motion` check (Tailwind's `motion-safe:`/
  `motion-reduce:` variants).

---

## 8. Content rules — bilingual UI chrome (REVISED)

Unlike the original version of this document, UI chrome is **not**
hardcoded to Spanish. It must follow the CV's own `detectedLanguage`
field (already populated by the extraction pipeline since task 1.3 —
available today, no dependency on Phase 3's task 3.2).

Maintain two small string dictionaries (e.g. in a `content.ts` alongside
the section components), keyed by `'en' | 'es'`, covering every fixed UI
string this design uses:

| Key | es | en |
|---|---|---|
| eyebrow | "Hola, soy" | "Hi, I'm" |
| about | "Sobre mí" | "About" |
| experience | "Experiencia" | "Experience" |
| education | "Educación" | "Education" |
| skills | "Skills" | "Skills" |
| additional | "Más" | "More" |
| present | "Presente" | "Present" |
| endUnspecified | "fin no especificado" | "end date not specified" |

Select the dictionary once, at the top level of the results view, based
on `resumeData.detectedLanguage`, and pass the resolved strings down —
don't re-check the language inside every leaf component.

Every other piece of visible text comes 1:1 from the data fields
described in `lib/extraction/schema/resume.ts`. Never invent, embellish,
or auto-summarize the person's own content, and never translate the
person's own content — only the fixed chrome strings above are
localized, the extracted content stays exactly as extracted.