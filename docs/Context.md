# Context

## What this is
A CV/résumé parser and redesigned profile viewer.

## What "done" means
1. A user uploads a CV (PDF, DOCX, both required).
2. The app extracts structured data: name, contact, work experience,
   education, skills — at minimum.
3. That data renders in a genuinely different visual design from the
   original document (not a reformatted copy).
4. The redesigned view is downloadable, not just viewable.
5. The app is publicly deployed and reachable via URL.

## Glossary
- **Grounding** — verifying that a value the LLM extracted actually
  appears in the source document, and locating exactly where. Produces
  a confidence level (high/medium/low/unverifiable) per field.
- **Golden set** — a curated set of ~12-15 synthetic/anonymized CVs
  (varied layouts, EN/ES, single/multi-page, scanned) used to measure
  extraction accuracy, latency, and cost. Lives in `eval/golden-set/`.
- **Walking skeleton** — a thin but complete end-to-end version of the
  app, deployed and working, before any feature is fully built out.
  Phase 0 of PLAN.md produces this.
- **Router** (model router) — the logic in Phase 7 that escalates from
  Haiku to Sonnet only when grounding confidence is low or validation
  failed twice. Capped at one escalation per request.
- **Context Pack** — this file and its siblings in `docs/`, following
  the GenDD (Generative-Driven Development) methodology: persistent,
  versioned files that give an AI coding agent the constraints and
  domain knowledge it needs, instead of re-explaining them per session.

## Non-goals (explicitly out of scope for this challenge)
- User accounts, authentication, multi-tenant anything.
- Persistent storage of uploaded files or raw extracted text (see
  architecture.md — zero persistence by default is a deliberate
  privacy decision, not a missing feature).

## Why decisions in this repo sometimes look "over-engineered" for a
## take-home
Two real constraints shape choices that might otherwise look like
scope creep: (1) the app will be publicly deployed with an LLM-backed
endpoint for several days during review, so cost and abuse protections
are load-bearing, not decorative; (2) code quality and architecture
decisions are fundamentall for the project's success.