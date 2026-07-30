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
> Checkpoint: upload a real text-based PDF and see extracted data on screen.

## Phase 2 — Complete minimum requirements
- [x] 2.1 DOCX adapter (mammoth.js)
- [x] 2.2 Final normalization (Stage 8)
- [x] 2.3 Error state catalog + components
- [x] 2.4 Export mechanism validated (window.print, print CSS, page
      breaks) against multi-section placeholder content — mechanism
      works, NOT yet proven against 2.5's final complex layout.
      Print-safety constraints for 2.5 documented in
      architecture.md (CSS Grid/Flexbox for page structure,
      position: sticky/fixed, overflow: hidden, print-color-adjust).
- [x] 2.5 Portfolio redesign — the actual "reimagined profile"
      requirement from the brief (25% of the evaluation, same weight
      as functionality). Portfolio-style, candidate-facing, per the
      resolved design decision. Must respect the print-safety
      constraints documented in 2.4. After building, re-verify PDF
      export still produces a clean result against this real design
      — not just the placeholder from 2.4.
- [ ] 2.6 Verified deploy with final domain, manual smoke test
      (include a real end-to-end PDF export check against the 2.5
      design as part of this smoke test)
> Checkpoint: the brief's minimum requirements are covered with a
> real designed output — not just data extraction with an undesigned
> table standing in for "redesign."

## Phase 3 — Extra features
- [ ] 3.1 Image/scanned adapter (vision, no grounding — per decision)
- [ ] 3.2 EN/ES detection + heuristic fallback (Stage 9)
- [ ] 3.3 Rate limit + daily budget (Redis) — Stage 3 complete
- [ ] 3.4 Haiku→Sonnet router (Stage 7)
- [ ] 3.5 Review/edit flow for extracted fields — real UI work,
      editable inputs layered on top of the 2.5 design, not internal
      logic only
- [ ] 3.6a Curate golden set — manual, outside Claude Code sessions,
      see testing.md
- [ ] 3.6b Build eval harness script (run-eval.ts) — delegable
- [ ] 3.7 Unit tests mirroring lib/extraction
> Checkpoint: every bonus point in the brief is covered.

## Phase 4 — Own differentiators
- [ ] 4.1 Full grounding (Stage 6) + offset mapping
- [ ] 4.2 Visual highlight click→document zone (PDF) — real UI
      interaction added on top of the 2.5 base design
- [ ] 4.3 UI/UX polish — refinement pass on the 2.5 design (spacing,
      micro-interactions, responsive tuning, the deferred fetch-
      timeout/UnexpectedError state below) — NOT the initial design
      direction, that's already decided and built in 2.5
- [ ] 4.4 Demo mode with precomputed results
- [ ] 4.5 Complete README with harness results, decisions, known limitations
> Checkpoint: product finished, ready for submission.

## Resolved decisions (from HatchWorks correspondence)
- **Design direction**: portfolio-style page, candidate-facing —
  confirmed choice, not just a default. Juan Carlos named this
  explicitly ("a portfolio-style page the candidate would actually
  want to share") while noting the exact visual execution is the
  candidate's judgment to exercise. No further question needed here.
- **Export (task 2.4/2.5)**: the PDF is the primary, required
  deliverable — must be genuinely print-ready/sendable to an
  employer. Since the on-screen design is portfolio-style (not
  dashboard), a print-CSS layout of that same portfolio page should
  be close to print-ready already. PNG export (html2canvas) may
  still exist as a minor secondary option, not the primary path.
- **AI-assisted process disclosure**: README-level disclosure only —
  no transcripts, prompt logs, or walkthrough needed.
- **Page cap at 3**: confirmed as sound cost control, no change.

## Deferred polish
- Client-side fetch timeout + generic "unexpected error" UI state —
  covers a hung request (e.g. connection drop mid-request) that the
  server-side catch-all in route.ts doesn't reach, since nothing ever
  returns to trigger it. Deferred to task 4.3.

## Environment notes
- Project path must not contain `&` — cmd.exe treats it as a command
  separator and breaks npm's generated .bin/*.cmd shims on Windows
  (surfaced as `next dev` failing with a truncated/wrong path). Fixed
  by relocating the repo. If a similar "file/command not found with a
  truncated path" error shows up again with any other tool, check for
  this first before assuming a dependency or config problem.