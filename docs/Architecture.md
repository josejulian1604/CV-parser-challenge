# Architecture

## Stack
- Next.js 15 (App Router) + TypeScript, single repo, single deploy.
- Vercel Hobby for deployment.
- Zod as the single source of truth for data shape (client and
  server both import from `lib/extraction/schema/`).
- Anthropic API (Claude Haiku 4.5 default, Sonnet 4.5 escalation) for
  extraction, behind a provider abstraction — see "Provider
  abstraction" below.
- Upstash Redis for rate limiting and daily budget tracking (shared
  state across serverless invocations — an in-memory counter does NOT
  work here, each invocation has its own memory).

## Why Next.js instead of separate React + Express
- One deploy, no CORS configuration between frontend and backend.
- Zod schema imported directly by both the API route and the React
  components — one source of truth instead of duplicated types.
- Route Handlers (`app/api/**/route.ts`) ARE the backend — Next.js
  doesn't remove the server, it colocates it. If asked "so there's no
  backend?": there is, it's Node.js running in a Route Handler.
- Known trade-off: serverless functions have execution time limits
  and no long-running background jobs. Not a concern at this scope.

## Privacy-by-architecture: the file never leaves the browser
The original CV file (PDF/DOCX/image) is parsed entirely client-side.
Only plain text or a compressed image crosses the network to the
server. This is a deliberate choice, not an optimization:
- Sidesteps Vercel's request body size limits.
- Reduces what the server needs to buffer/process.
- Real privacy story: PII-bearing files never touch a server disk.

## Domain core must stay framework-agnostic
Everything under `lib/extraction/` must have zero imports from
`next`. Route Handlers are thin adapters (~10 lines) that call into
`lib/extraction/pipeline.ts`. This is what makes "this could be
migrated to Express in an afternoon" a true statement, verifiable by
reading the code, not a claim made in the README.

## The pipeline (9 stages, `lib/extraction/pipeline.ts` composes them)

1. **Classify** (`adapters/classify.ts`) — browser, $0. Detect
   PDF-with-text / DOCX / scanned-PDF / image by checking extracted
   character count per page against a threshold.
2. **Normalize** (`adapters/{pdf,docx,image}.ts`) — browser, $0.
   Reduce all four input types down to either plain text or a
   compressed image. For PDF: reconstruct a canonical `text` string
   AND link every character range in it back to its source
   `{page, x, y, fontSize}` — see "Offset linking" below. This link is
   what makes grounding (stage 6) possible later; it is not optional
   plumbing.
3. **Cross to server** — only plain text or compressed image is sent,
   never the original file. Server applies, in order: (a) IP rate
   limit via Redis, (b) daily budget check via Redis — if exceeded,
   short-circuit to demo mode, no LLM call, (c) input limits (max 3
   pages, max char count, both in `lib/config/limits.ts` as named
   constants, not magic numbers).
4. **Structure** (`structure/structure.ts`) — server, paid. Single
   call to Claude Haiku 4.5, temperature 0, against a JSON Schema
   derived from `ResumeDataSchema` via Zod v4's native
   `z.toJSONSchema()` (not the `zod-to-json-schema` package — it's
   runtime-incompatible with Zod v4 and silently produces an empty
   schema). System prompt (`structure/prompt.ts`, kept versioned for
   the eval harness) instructs: never invent, use null for missing
   fields. Prompt-cache the system prompt + schema block (large,
   identical across calls).
   **Documented trade-off:** the schema is embedded as prompt text,
   not passed via `output_config.format`. Anthropic's schema compiler
   caps total nullable/union-typed parameters at 16;
   `ResumeDataSchema` exceeds that once nested schemas (e.g.
   `DateRangeSchema`, reused by both `experience` and `education`) are
   inlined per occurrence rather than shared — confirmed against the
   real API (19 parameters, rejected). Weakening the schema's
   deliberate "always null, never omit a key" design (see schema/
   Stage 1 note) to fit under the cap was rejected in favor of
   dropping API-enforced schema validation for this stage: structural
   correctness now relies entirely on stage 5's
   `ResumeDataSchema.safeParse()` + repair loop, not an API-level
   guarantee. One consequence: without `output_config.format`, the
   model is no longer constrained to emit bare JSON, so
   `structure/provider.ts` defensively strips a leading/trailing
   markdown code fence (a "json" fenced block) before parsing.
5. **Validate & repair** (`validation/repair.ts`) — server, cheap.
   `ResumeDataSchema.safeParse()`. On failure, send the validation
   errors back to the SAME model (Haiku) for a format fix — schema
   failures are almost always formatting issues, not comprehension
   issues, so escalating here would be wasted cost. Max 2 attempts.
6. **Grounding** (`grounding/*.ts`) — server, $0, deterministic. For
   every leaf string field, search for it in the original source
   text: exact match → high; normalized match (lowercase, no accents,
   collapsed whitespace) → high; fuzzy match above ~0.85 similarity →
   medium; no match → low. Image-sourced documents have no independent
   source text, so every field there is `unverifiable`, not low — see
   "Known limitation: scanned CVs" below. When the match came from
   normalized or fuzzy matching, the found offset is in the
   transformed string, not the original — must be mapped back before
   storing `span`/`bbox`, or highlighting will point at the wrong
   text.
7. **Escalate** (`escalation/router.ts`) — server, paid, conditional.
   Escalate Haiku → Sonnet only if: grounding score is below
   threshold, OR a critical field (name/email) is missing, OR both
   repair attempts in stage 5 failed. Hard cap: one escalation per
   request, never a loop.
8. **Normalize output** (`normalize/*.ts`) — server, $0. Dates to
   ISO where possible (keep `raw` string always — grounding needs the
   literal text, not the normalized value). Email/phone re-validated
   by regex regardless of what the model claimed, surfaced as an
   `isEmailValid`/`isPhoneValid` flag rather than silently dropped or
   kept indistinguishable from a valid value. Skills deduplicated by
   the most-common exact casing variant per skill (not a hardcoded
   canonical-casing dictionary — unbounded maintenance for a problem
   "most common wins" already solves in practice). `detectedLanguage`
   is the model's own stage 4 output, passed through unchanged here;
   heuristic-only language detection independent of the model belongs
   to stage 9's fallback (PLAN.md 3.2), not this stage.
9. **Fallback** (`fallback/heuristic.ts`) — $0, last resort. Runs on
   any failure (network, budget exhausted, provider down, repeated
   validation failure). Regex-only extraction of email, phone,
   LinkedIn/GitHub URLs, best-effort name from the first lines.
   Returns a partial result with a degraded flag — the screen must
   never be blank; this is an explicit functional requirement from
   the challenge brief.

## Provider abstraction (`structure/provider.ts`)
An `LLMProvider` interface with an Anthropic implementation and a
fallback (e.g. Gemini Flash free tier). If Anthropic credits run out
mid-week, switching providers is a config change, not a rewrite. This
exists because the deployed app being reachable is the one
non-negotiable requirement in the brief's submission rules.

## Grounded schema — two schemas, two moments
`ResumeDataSchema` (what the LLM returns, stage 4-5) is intentionally
NOT the same schema as `GroundedResumeSchema` (built in stage 6 by
wrapping select leaf fields with `{value, confidence, span, page,
bbox}`). Reasons: asking the LLM to self-report confidence inside the
same object it's generating is unreliable (models don't know their
own error rate); it also bloats prompt/output token cost. Grounding
wraps only leaf string values — never whole arrays like `experience`,
and never `dateRange` as a unit (only `dateRange.start.raw` /
`dateRange.end.raw` get wrapped, since the normalized date isn't what
appears verbatim in the source text).

## Offset linking (what makes stage 6 possible)
When stage 2 reconstructs `doc.text` for a PDF, every substring it
appends must record which source item (`{page, x, y, fontSize}`) it
came from, keyed by character offset range — not by searching for the
text again later. This resolves ambiguity when a value like a company
name appears more than once in the document (e.g. once in Experience,
once in a certification title): grounding looks up "what block covers
offset 1420", not "search for this string somewhere".

## Known limitation: two-column PDFs
Naive text reconstruction (grouping by y-band, then sorting by x)
breaks reading order on two-column layouts — text interleaves and
reads incoherently. Acceptable for this scope (the brief does not
require handling every layout); documented explicitly in the README
under "known limitations," not silently swept under the rug.

## Known limitation: scanned CVs have no visual highlight
Per project decision: the scanned/image route has no source text to
ground against, so it does NOT get click-to-highlight in v1. Fields
from that route are marked `unverifiable` in the UI rather than given
a false confidence level. This may be revisited in Phase 4 if time
allows (see PLAN.md); it is not currently planned.

## DOCX has no bounding box
Mammoth.js gives structured text (headings, lists) but no page
coordinates. Grounding still works (confidence + text span), but
"click to highlight on the rendered page" only applies to the PDF
route. DOCX highlighting targets a plain-text view, not a rendered
page image. This is a different behavior, not a bug.

## Known limitation: DOCX tables
Mammoth renders table cells as plain paragraphs with no signal that
they came from a table. The DOCX adapter reads them in raw row-by-row
document order, same as any other paragraph — a multi-column table
(e.g. a skills grid or a date/role sidebar) will interleave the same
way two-column PDFs do (see "Known limitation: two-column PDFs").
Acceptable for this scope; revisit if a golden-set CV actually uses
table-based layout.

## Print export constraints
Task 2.4 validated `window.print()` + print CSS against real
multi-section content (sample-1.pdf's 6-section extraction, rendered
through the plain results view) — the mechanism works. Task 2.5's
final portfolio design must respect these constraints, discovered
against that real content, not against 2.5's own layout yet:

- **CSS Grid/Flexbox for top-level page structure is risky.** Fine for
  small internal components (e.g. a row of pills, a two-column detail
  line), but a whole-page Grid/Flexbox layout fragments unreliably
  across printed pages — browsers don't guarantee sensible breaks
  inside grid/flex containers the way they do for normal block flow.
- **`position: sticky`/`fixed` don't translate to print** — there is
  no viewport to stick/fix to across paginated output; anything relying
  on either will misbehave or simply not render as intended.
- **`overflow: hidden` on content containers clips instead of
  paginating.** A container sized for one screen height that clips its
  overflow will silently cut off content at a page boundary instead of
  flowing it onto the next page.
- **Any background color that carries meaning needs
  `print-color-adjust: exact` (and `-webkit-print-color-adjust: exact`)
  explicitly on that element.** Browsers suppress background-color
  printing by default; without this, a colored section header or
  sidebar just prints white.
- **`break-inside: avoid` must be scoped to atomic units, not whole
  sections that can legitimately span multiple pages.** A section like
  Experience (several jobs, each with bullets) is often taller than
  one page — `break-inside: avoid` on the whole section either gets
  ignored (browser breaks it somewhere arbitrary anyway) or forces a
  large blank gap by pushing the entire section to the next page.
  The pattern that actually works: `break-after: avoid` on the section
  heading (keeps the header glued to what follows it, without
  constraining section length), and `break-inside: avoid` on each
  individual entry (one job, one degree — short, atomic, never split
  mid-bullet). Whole-section `break-inside: avoid` is only safe for
  inherently short, atomic sections (Contact, Summary, Skills, short
  item-list sections).

## Folder structure

    app/                      # Next.js — UI + thin adapters only
      page.tsx                # upload
      api/extract/route.ts    # calls pipeline.ts, ~10 lines
      result/page.tsx         # redesigned view
    components/
      upload/
      result/
      shared/
      error-states/           # one component per error in the catalog
    lib/
      extraction/             # the core — NO next imports allowed
        schema/                 (resume.ts, grounded.ts, date.ts, partial.ts)
        adapters/                (types.ts, pdf.ts, docx.ts, image.ts, classify.ts)
        structure/               (prompt.ts, provider.ts, structure.ts)
        validation/               (repair.ts)
        grounding/                 (match.ts, offset-mapping.ts, ground.ts)
        escalation/                 (router.ts)
        normalize/                   (dates.ts, contact.ts, skills.ts)
        fallback/                     (heuristic.ts)
        pipeline.ts              # composes all 9 stages — the ONLY
                                   entry point the route handler calls
      budget/                  # rate-limit.ts, daily-budget.ts (Redis)
      export/                  # pdf.ts, image.ts
      config/limits.ts         # named constants, e.g. maxPages = 3
    eval/                     # harness — lives OUTSIDE lib/, it's a
      golden-set/               dev-time tool, not runtime code
      expected/
      run-eval.ts
      results/
    data/demo/                # precomputed results for demo mode
    tests/
      unit/                    # mirrors lib/extraction/ 1:1
      e2e/
      fixtures/                # small per-stage test inputs, NOT the
        pdf/                     eval golden set — e.g. 2-3 PDFs used
                                  by adapters/pdf.test.ts. No sidecar
                                  JSON: known-correct values (reading-
                                  order substring checks via
                                  expectInOrder, page count, block
                                  count lower bounds) are authored
                                  once by a human who opened the file
                                  and written inline in the test file
                                  next to the fixture they check,
                                  rather than in a separate
                                  `<name>.expected.json`. Revisit this
                                  if a future adapter's fixtures
                                  genuinely need the simpler
                                  {textContains, pageCount,
                                  headingCount} sidecar shape instead
                                  — e.g. many fixtures sharing one
                                  assertion shape, where inline checks
                                  would duplicate structure per file.
    docs/                    # this Context Pack
    PLAN.md
    CLAUDE.md