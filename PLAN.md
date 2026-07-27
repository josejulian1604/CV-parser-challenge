# PLAN.md — HatchWorks CV Parser

Status legend: [ ] pending · [~] in progress · [x] done

## Phase 0 — Skeleton (walking skeleton)
- [ ] 0.1 Create root CLAUDE.md + docs/*.md (Context Packs) — manual, not delegated
- [ ] 0.2 Scaffold folder structure per architecture.md
- [ ] 0.3 Init Next.js 15 + TS + Tailwind, base configuration
- [ ] 0.4 Empty deploy to Vercel, public URL verified
- [ ] 0.5 GitHub Actions CI: typecheck + lint
> Checkpoint: the public URL exists and responds. Commit.

## Phase 1 — Required core, happy path (text-based PDF only)
- [ ] 1.1 ResumeDataSchema + PartialDateSchema (Zod)
- [ ] 1.2 PDF adapter (Stages 1-2) with offset↔bbox linking
- [ ] 1.3 Route handler + Anthropic provider (Stage 4, no router yet)
- [ ] 1.4 Validation + repair (Stage 5)
- [ ] 1.5 Minimal UI: upload + undesigned results table
> Checkpoint: upload a real text-based PDF and see extracted data on screen.

## Phase 2 — Complete minimum requirements
- [ ] 2.1 DOCX adapter (mammoth.js)
- [ ] 2.2 Final normalization (Stage 8)
- [ ] 2.3 Error state catalog + components
- [ ] 2.4 Export: PDF (print CSS) + PNG (html2canvas)
- [ ] 2.5 Verified deploy with final domain, manual smoke test
> Checkpoint: the brief's minimum requirements are 100% covered.

## Phase 3 — Extra features
- [ ] 3.1 Image/scanned adapter (vision, no grounding — per decision)
- [ ] 3.2 EN/ES detection + heuristic fallback (Stage 9)
- [ ] 3.3 Rate limit + daily budget (Redis) — Stage 3 complete
- [ ] 3.4 Haiku→Sonnet router (Stage 7)
- [ ] 3.5 Review/edit flow for extracted fields
- [ ] 3.6a Curate golden set — manual, outside Claude Code sessions,
      see testing.md
- [ ] 3.6b Build eval harness script (run-eval.ts) — delegable
- [ ] 3.7 Unit tests mirroring lib/extraction
> Checkpoint: every bonus point in the brief is covered.

## Phase 4 — Own differentiators
- [ ] 4.1 Full grounding (Stage 6) + offset mapping
- [ ] 4.2 Visual highlight click→document zone (PDF)
- [ ] 4.3 Polished UI/UX — final design direction
- [ ] 4.4 Demo mode with precomputed results
- [ ] 4.5 Complete README with harness results, decisions, known limitations
> Checkpoint: product finished, ready for production.

## Active assumptions (pending external confirmation)
- Export: both formats (print-ready PDF + PNG) are being built until
  advised differently. If the answer changes the approach, 
  adjust in Phase 2 without reworking the rest of the pipeline.