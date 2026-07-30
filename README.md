# CV Parser & Reimagined Profile

## Overview

This app takes a candidate's CV — a PDF, a Word document, a scanned
PDF, or even a photo of a printed resume — and turns it into a
genuinely redesigned, candidate-facing portfolio page: name, contact
details, work experience, education, and skills extracted into
structured data by an LLM, then rendered in a distinct visual design
rather than a reformatted copy of the original document. The result
is downloadable as a print-ready PDF (the primary export) or a PNG
snapshot (secondary), so a candidate can actually send it to an
employer. The original file never leaves the browser — only plain
text or a compressed image crosses the network.

## Live demo & repo

Sent via email for security purposes.

## Setup / run instructions

Requirements: Node.js, npm.

```bash
git clone <repo-url>
cd CV_Parser_HatchWorks
npm install
```

Create `.env.local` at the repo root with one variable (see
`.env.example`):

```
ANTHROPIC_API_KEY=
```

Get a key from the [Anthropic Console](https://console.anthropic.com/)
(API Keys section). The app calls Claude Haiku 4.5 for extraction —
this key is required for the upload flow to work at all; without it,
every extraction attempt will fail at the structuring step.

Then:

```bash
npm run dev       # starts the app at http://localhost:3000
npm run build     # production build
npm run start     # run the production build
npm run lint      # eslint
npm run test      # unit tests (Vitest) — no API key needed, no network calls
npm run test:e2e  # end-to-end tests (Playwright) — starts its own dev server;
                   # the real "upload a PDF" flow test does call the live
                   # Anthropic API, so ANTHROPIC_API_KEY must be set first
```

**Windows note:** the repo path must not contain an `&` character —
`cmd.exe` treats it as a command separator and breaks npm's generated
`.bin/*.cmd` shims, surfacing as a confusing "file/command not found"
error with a truncated path. If you hit that, check the path first
before assuming a dependency problem.

## Architecture & extraction approach

### Why the file never leaves the browser

The original CV file — PDF, DOCX, image, whatever format — is parsed
entirely client-side, in the browser. Only plain reconstructed text or
a compressed image ever crosses the network to the server. This isn't
an optimization; it's the actual privacy story: a candidate's
personally identifying information never touches a server disk,
because the file that contains it is never sent there in the first
place. It also sidesteps request body size limits on the hosting
platform and reduces what the server needs to buffer.

### Next.js as a real full-stack framework, not "no backend"

This is a single Next.js 15 app (App Router), not a separate frontend
and API server. That's a deliberate choice, not a shortcut: one
deploy, no CORS configuration between a frontend and a backend that
don't exist as separate things, and a single Zod schema imported
directly by both the API route and the React components, so the data
shape has one source of truth instead of two copies that can drift
apart. To be clear about what this does and doesn't mean: there is a
backend — `app/api/extract/route.ts` is a Node.js Route Handler, it's
just colocated in the same project rather than deployed separately.
The domain logic itself (everything under `lib/extraction/`) has zero
imports from Next.js, specifically so that claim stays true if this
ever needed to move to a standalone Express server — that's
verifiable by reading the code, not just an assertion.

### The pipeline, as it actually works today

1. **Classify** (client-side) — the uploaded file is routed to one of
   four paths based on its type and, for PDFs specifically, how much
   extractable text it actually contains per page. A PDF with a real
   text layer goes one way; a PDF that's actually a scan (near-zero
   extractable characters) goes another; DOCX and image uploads are
   detected directly from the file type.
2. **Adapt** (client-side) — each route reduces the file down to
   either plain text or a compressed image, since that's all that
   crosses the network. Text-based PDFs are reconstructed into a
   single string via `pdf.js`, with every character range linked back
   to its position in the source document (page, x/y, font size) —
   this offset-linking isn't used yet (see "Known limitations" below),
   but it's the data structure that would make click-to-highlight
   possible later. DOCX is read via `mammoth.js`, preserving heading
   structure. Scanned PDFs get their pages rendered to a canvas and
   compressed to JPEG; a directly uploaded photo/screenshot gets
   resized and compressed the same way — both capped in resolution to
   what a vision model actually needs, since a larger image just costs
   more without improving accuracy.
3. **Cross to server** — only the reconstructed text or the compressed
   image(s) are sent, capped at 3 pages. That page cap was a specific,
   confirmed cost-control decision (see the Q&A section below), not an
   arbitrary limit.
4. **Structure** — a single call to Claude Haiku 4.5, temperature 0,
   asking for a JSON object matching the extraction schema. The same
   code path handles both text and image input — the request is built
   as either a plain string or an array of image content blocks
   depending on the upload route, but it's one adapted function, not a
   separate implementation duplicating the same prompt rules for each
   input type. **A real API constraint shaped this stage directly**:
   the schema was originally meant to be enforced by Anthropic's own
   structured-output feature (`output_config.format`), but that
   feature caps the total number of nullable/union-typed parameters at
   16 — and this schema's real parameter count, once nested types like
   the date-range shape are counted per place they're reused, came to
   19, confirmed against the real API (it rejected the request).
   Rather than weaken the schema's design to fit under that cap, the
   schema is instead embedded directly as text inside the prompt, and
   structural correctness is guaranteed by the next stage instead of
   by the API.
5. **Validate & repair** — the model's JSON response is checked against
   the schema (Zod). If it fails, the validation errors are sent back
   to the same model with instructions to fix only what was flagged,
   up to two attempts, before giving up. Schema failures are almost
   always formatting slips, not comprehension failures, so this stays
   on the cheap model rather than escalating.
6. **Normalize output** — a deterministic, non-LLM pass over the
   validated result: dates are re-parsed from their original text
   independently of what the model claimed (handling year-only dates,
   localized month names in English and Spanish, and the honest
   distinction between "this role is ongoing" and "the end date is
   simply unknown" — the model isn't allowed to guess "Present" for
   the latter); email and phone are re-validated by regex regardless
   of what the model reported, surfacing the result as an explicit
   valid/invalid flag rather than silently trusting or discarding a
   bad value; skills are deduplicated, keeping whichever casing
   variant appeared most often rather than forcing a hardcoded style.
7. **Render & export** — the structured result renders as a distinct,
   designed portfolio page (not a reformatted table of the input),
   downloadable as a print-ready PDF via the browser's native print
   pipeline (the primary, required export) or as a PNG snapshot of the
   on-screen design via `html2canvas` (a secondary, best-effort
   format).

### Two schema design choices worth calling out specifically

**Nullable fields, not optional ones.** Every field the model can't
find is represented as an explicit `null`, not an omitted key. This
forces the model to actively commit to "this isn't in the source,"
rather than leaving an ambiguous gap between "the model forgot to
extract this" and "it genuinely isn't present" — which matters because
a resume missing a field (no listed phone number, no summary section)
is a completely normal, expected case, not a failure to paper over.

**`additionalSections` is deliberately open-ended.** Real resumes vary
enormously in what extra sections they include — certifications,
publications, languages, volunteer work, awards, side projects — and a
fixed schema would either drop content that doesn't fit a predefined
category, or need constant updates to chase every CV's idiosyncratic
organization. Instead, this field is a list of `{title, items[]}`
pairs, letting the model surface whatever the source document actually
labeled, under its own heading, without the app inventing or
constraining what categories are allowed to exist.

**Zero persistence.** No uploaded file, no reconstructed text, and no
extraction result is stored anywhere server-side. Each request is
stateless; the only place a result lives after extraction is in-memory
in the browser tab, bridging the upload page to the result page — it
doesn't survive a page refresh, and that's intentional, not a bug.

### What was designed but not built

`docs/architecture.md` documents a fuller 9-stage pipeline than what's
actually wired up today, including two stages that don't exist in this
codebase at all:

- **Grounding** (verifying each extracted value actually appears in
  the source document, with a confidence level) is not implemented.
- **Escalation** (automatically retrying a low-confidence extraction on
  a stronger model, Claude Sonnet) is not implemented — every
  extraction uses Haiku only.
- **A regex-only fallback stage**, meant to produce a partial result
  when the LLM path fails entirely, is not implemented — a hard
  failure today shows a generic error state, not a degraded partial
  result.
- **Server-side rate limiting and daily budget tracking** (originally
  planned via Upstash Redis) is not implemented — see "Known
  limitations" below for the actual mitigation in place.
- **A second LLM provider** (the architecture allows for a fallback
  provider if Anthropic becomes unavailable) — only one provider
  (Anthropic) is actually implemented.

These are described in detail, with their concrete consequences, in
"Known limitations" below — this section exists so the distinction
between "designed" and "shipped" is never ambiguous.

## AI-assisted development process

This codebase was built with [Claude Code](https://claude.com/claude-code)
as the implementation tool, under a structured process, not an
unsupervised "build me an app" prompt:

- **Context Packs defined the constraints up front.** Before any code
  was written, a set of persistent docs (`CLAUDE.md` and `docs/*.md` —
  architecture, conventions, testing strategy, domain glossary, agent
  permissions) captured the project's decisions, folder structure, and
  house rules, so those didn't need to be re-explained or
  re-negotiated in every session.
- **One task at a time, scoped to roughly one module.** Work was
  broken into units the size of one pipeline stage, one adapter, or
  one component per turn — never "implement the whole feature" as a
  single unsupervised instruction — tracked against a running plan
  (`PLAN.md`).
- **Every diff was reviewed before commit.** No change was
  auto-approved; the developer read and approved the actual diff each
  time before it was committed. Commits carry no AI-attribution
  footer — they're written to read as authored by the developer,
  consistent with treating this as developer-directed work with an AI
  tool, not co-authored output.
- **A dedicated code-reviewer subagent was used on specifically
  higher-risk modules** — a second, independent read-only pass focused
  on correctness and missed edge cases, distinct from the
  implementation work itself. In this project that included the
  PDF/DOCX adapters, the cross-page state-transfer mechanism (where a
  bug would silently discard an already-paid-for extraction result),
  and the multimodal (text-or-image) provider call shape introduced
  for the scanned/photo upload routes. This review step caught real
  issues before they shipped — for example, a page-navigation race
  condition that could redirect a user to an error screen right after
  a successful extraction, and a font-loading timing gap in the PNG
  export path — both fixed and re-verified before being considered
  done.

## Known limitations

Specific, not just named — each of these is a real, current gap and
what it actually means for someone using the app today:

- **No confidence indicators or click-to-highlight source.** There's
  no way to tell, from the rendered result, whether a given field is
  trustworthy or which part of the original document it came from —
  every extracted value is presented with equal, unverified confidence.
- **No automatic escalation to a stronger model.** Every extraction
  runs on Claude Haiku 4.5 only. A CV with unusual formatting that a
  larger model might read more accurately doesn't get a second attempt
  with more capability — only the same-model repair loop, which fixes
  formatting mistakes, not comprehension mistakes.
- **No server-side rate limiting or spend protection.** The publicly
  deployed endpoint has no protection against high-volume or abusive
  use during the review window. The only safety net is a spending
  alert configured directly in the Anthropic console — it limits
  worst-case runaway cost but does nothing to protect availability if
  the endpoint is hammered with requests.
- **No way to correct a misread field.** If extraction gets a value
  wrong, the only recourse is re-uploading — and since extraction runs
  at temperature 0, re-uploading the exact same file will very likely
  reproduce the same mistake. There's no in-app edit flow.
- **No non-LLM fallback path.** `detectedLanguage` and the bilingual UI
  chrome it drives already work via the model's own output today. But
  if the LLM path fails outright — provider down, network issue,
  repeated validation failure — there's no regex-only last-resort
  extraction to fall back to. The user sees a generic error state, not
  a partial, best-effort result.
- **No measured accuracy, latency, or cost numbers.** The eval harness
  (a golden set of curated CVs plus a scoring script) was never built.
  Any claim about extraction quality in this document is based on
  manual review of individual test uploads during development, not a
  systematic measurement — and no such number is claimed here for
  that reason.
- **Two-column PDF layouts could read out of order.** Text reconstruction
  groups content by vertical position and reads left-to-right within
  each band; on a genuinely two-column resume layout, this can
  interleave unrelated columns' text, producing a garbled reading order
  for that page.
- **DOCX highlighting, if built later, would target text only.**
  Word documents carry no page-coordinate information, so any future
  click-to-highlight for DOCX could only jump to a location in a
  plain-text view, never to a position on a rendered page image the
  way a PDF could.
- **No demo mode.** Every visit requires a real file upload and a real,
  paid extraction call — there's no precomputed example available to
  browse without spending API budget.
- **PNG export was verified manually, not exhaustively.** The PNG path
  was tested against two real fixtures (one short resume, one long,
  multi-section one) and a specific, code-reviewed set of known
  html2canvas risk areas (font-loading timing, the watermark's text-
  stroke rendering, color accuracy, full-height capture) — all
  confirmed correct in those two cases, but there's no automated
  visual-regression coverage across arbitrary resume content.
- **Test coverage stops at what was built.** Unit and end-to-end tests
  exist for the modules built during this project, but no dedicated
  test-hardening pass beyond that was done.

## What I'd improve with more time

In roughly the order I'd tackle them:

1. **Grounding, confidence indicators, and click-to-highlight.** This
   is the single biggest gap relative to the original design, and the
   groundwork for it already exists — the PDF adapter already links
   every character offset back to its source position on the page,
   specifically so this could be built without redoing that part.
2. **A real eval harness.** A curated golden set of 12-15 varied CVs
   (different layouts, both languages, scanned examples included),
   scored for field accuracy, latency, and cost — and specifically,
   a measured Haiku-only vs. Haiku-with-escalation comparison, since
   that's the number that would actually justify (or rule out) the
   router below, rather than assuming it's worth the added cost.
3. **The Haiku→Sonnet escalation router**, conditioned on that eval
   data — only escalating when grounding confidence is low or repair
   has failed twice, capped at one escalation per request.
4. **Redis-backed rate limiting and daily budget enforcement**,
   replacing the manual console spending alert with real per-IP and
   global protection.
5. **A review/edit flow**, letting a user correct a specific misread
   field in place instead of re-uploading and hoping for a different
   result.
6. **A UI/UX polish pass** on top of the shipped design direction —
   spacing, responsive behavior, and micro-interaction refinement that
   there wasn't time to iterate on beyond the initial build.
