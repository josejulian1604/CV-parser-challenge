# PLAN.md — HatchWorks CV Parser

Status legend: [ ] pending · [~] in progress · [x] done

## Phase 0 — Skeleton (walking skeleton)
- [x] 0.1 Create root CLAUDE.md + docs/*.md (Context Packs) — manual, not delegated
- [x] 0.2 Scaffold folder structure per architecture.md
- [x] 0.3 Init Next.js 15 + TS + Tailwind, base configuration
- [x] 0.4 Empty deploy to Vercel, public URL verified
- [x] 0.5 GitHub Actions CI: typecheck + lint
> Checkpoint: the public URL exists and responds. Commit.

## Phase 1 — Required core, happy path (text-based PDF only)
- [x] 1.1 ResumeDataSchema + PartialDateSchema (Zod)
- [x] 1.2 PDF adapter (Stages 1-2) with offset↔bbox linking
- [x] 1.3 Route handler + Anthropic provider (Stage 4, no router yet)
- [x] 1.4 Validation + repair (Stage 5)
- [x] 1.5 Minimal UI: upload + undesigned results table
      (superseded by task 2.5's redesign and the route split —
      kept as historical record, not live documentation)
> Checkpoint: upload a real text-based PDF and see extracted data on screen.

## Phase 2 — Complete minimum requirements
- [x] 2.1 DOCX adapter (mammoth.js)
- [x] 2.2 Final normalization (Stage 8)
- [x] 2.3 Error state catalog + components
- [x] 2.4 Export mechanism validated (print CSS, page breaks)
- [x] 2.5 Portfolio redesign (docs/design-spec.md) + route split
      (upload / and result /result, in-memory state transfer)
- [x] 2.6 Verified deploy, manual smoke test (six-step flow, passed)
> Checkpoint: brief's minimum requirements covered with a real
> designed, deployed output. CLOSED.

## Phase 3 — Extra features (SCOPE REDUCED — time constraint)
Given the submission deadline, only the following are being built.
Everything else in this phase is explicitly deferred — see "Deferred
scope" below, which doubles as README "known limitations" content.

- [x] 3.1 Image/scanned adapter (vision, no grounding — per decision)
- [ ] 3.8 PNG export as a second download format, alongside the
      existing print-ready PDF — per the "Resolved decisions" section
      below, this was already flagged as an optional secondary path;
      now confirmed in scope.
> Checkpoint: PNG export available alongside PDF.

### Deferred scope (time constraint — not started)
- **3.5 Review/edit flow for extracted fields** — cut from scope
  given the deadline. No way to correct a misread field short of
  re-uploading; if extraction gets something wrong, it ships wrong.

### Deferred scope (time constraint — not started)
- **3.2 EN/ES heuristic fallback (Stage 9)** — the LLM-based language
  detection (`detectedLanguage`) already works today (task 1.3,
  confirmed working) and drives the UI's bilingual chrome. What's
  deferred is the no-LLM regex-only fallback path for when the model
  is unavailable — the app currently has no Stage-9 equivalent at
  all, so extraction failures fall through to a generic error state
  rather than a partial heuristic result.
- **3.3 Rate limit + daily budget (Redis)** — real residual risk: the
  deployed endpoint has no server-side protection against high-volume
  or abusive use during the review window. Partial mitigation in
  place: a spending alert configured directly in the Anthropic
  console (no code, covers the worst case of runaway cost, doesn't
  cover availability/abuse).
- **3.4 Haiku→Sonnet router** — Haiku 4.5 alone is used for every
  extraction; no automatic escalation on low-confidence results.
- **3.6a/b Eval harness (golden set + metrics)** — no measured
  accuracy/cost numbers exist; any such figures can't be claimed in
  the README.
- **3.7 Additional unit tests beyond what exists** — current coverage
  stops at what earlier tasks already built.

## Phase 4 — Own differentiators (SCOPE REDUCED — time constraint)
- [ ] 4.5 Complete README — setup instructions, architecture and
      extraction-approach decisions, AI-assisted-process disclosure,
      known limitations (= the "Deferred scope" list above), what
      would be improved with more time.
> Checkpoint: submission-ready.

### Deferred scope (time constraint — not started)
- **4.1/4.2 Grounding + visual highlight** — no confidence indicators,
  no click-to-highlight-source feature. The "confidence indicators"
  bonus point from the brief is not covered.
- **4.3 UI/UX polish pass** — the design from task 2.5 ships as-is,
  no additional refinement pass.
- **4.4 Demo mode with precomputed results** — not built; every
  visit requires a real upload and a real paid extraction call.

## Resolved decisions (from HatchWorks correspondence)
- **Design direction**: portfolio-style page, candidate-facing —
  confirmed choice, not just a default.
- **Export**: the PDF is the primary, required deliverable — must be
  genuinely print-ready/sendable to an employer. PNG export is now
  confirmed in scope as task 3.8 (see above), as a secondary format.
- **AI-assisted process disclosure**: README-level disclosure only —
  no transcripts, prompt logs, or walkthrough needed.
- **Page cap at 3**: confirmed as sound cost control, no change.

## Environment notes
- Project path must not contain `&` — cmd.exe treats it as a command
  separator and breaks npm's generated .bin/*.cmd shims on Windows.
  If a similar "file/command not found with a truncated path" error
  shows up again with any other tool, check for this first.