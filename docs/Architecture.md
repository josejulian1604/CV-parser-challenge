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
   call to Claude Haiku 4.5, temperature 0, structured output against
   a JSON Schema derived from `ResumeDataSchema` via
   `zod-to-json-schema`. System prompt (`structure/prompt.ts`, kept
   versioned for the eval harness) instructs: never invent, use null
   for missing fields. Prompt-cache the system prompt + schema block
   (large, identical across calls).
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
   by regex regardless of what the model claimed. Skills deduplicated
   with canonical casing. Language detected (en/es).
9. **Fallback** (`fallback/heuristic.ts`) — $0, last resort. Runs on
   any failure (network, budget exhausted, provider down, repeated
   validation failure). Regex-only extraction of email, phone,
   LinkedIn/GitHub URLs, best-effort name from the first lines.
   Returns a partial result with a degraded flag — the screen must
   never be blank.

## Provider abstraction (`structure/provider.ts`)
An `LLMProvider` interface with an Anthropic implementation and a
fallback (e.g. Gemini Flash free tier). If Anthropic credits run out
mid-week, switching providers is a config change, not a rewrite. This
exists because availability is fundamental.

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
reads incoherently. Acceptable for this scope; documented explicitly in the README
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
    docs/                    # this Context Pack
    PLAN.md
    CLAUDE.md