# CLAUDE.md

This is a CV parser and reimagined profile viewer. Full context lives in:

- docs/context.md       — domain, glossary, project goals
- docs/architecture.md  — pipeline stages, folder structure, data flow
- docs/conventions.md   — error handling, naming, comments, testing
- docs/agents.md        — subagents, permissions, git commit rules
- docs/testing.md       — testing strategy, eval harness
- PLAN.md               — current phase, task list, status

Always check PLAN.md at the start of a session to see what phase and
task is active. Work on one task at a time — the one explicitly given
in the current message, not the whole phase. Stop and show the diff
for review before committing; never chain multiple tasks in one turn
without a checkpoint.