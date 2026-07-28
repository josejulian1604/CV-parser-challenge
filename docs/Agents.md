# Agents

## Working model
This project uses Claude Code as a single tool operated by one human
(the developer). "Agents" here means Claude Code's subagent feature —
scoped sub-sessions with their own context and tool permissions — not
multiple independent AIs coordinating autonomously. The human directs
every task, reviews every diff, and approves every commit. No task is
delegated at the scale of "build the whole app" — tasks are scoped to
roughly one module (one pipeline stage, one adapter, one component)
per turn, per PLAN.md.

## Subagents defined for this project
Two, defined as files in `.claude/agents/` (name, description, tools,
model in frontmatter — see those files for the exact definitions):

- **code-reviewer** — read-only tools only (no file writes). Reserved
  for higher-risk modules specifically: the PDF adapter's offset↔bbox
  linking, grounding, escalation/router, validation/repair. Checks
  the diff against docs/conventions.md and flags violations, missed
  error paths, and Result-type misuse.
- **test-writer** — write access limited to `tests/unit/**`. Also
  reserved for the same higher-risk modules.

For most modules (adapters, normalize, simple UI components), the
main session writes both the implementation AND its mirrored tests
directly in the same turn — formally invoking a subagent for every
small module is unnecessary overhead for a project this size. Only
escalate to the code-reviewer / test-writer subagents explicitly
(by name, or @-mention) for the handful of modules where the extra
scrutiny is worth the overhead.

Design and documentation tasks are given directly to the main session
as regular instructions — not worth formalizing as subagents at this
scope.

Regardless of who writes tests (main session or test-writer
subagent), tests must actually be RUN and shown passing before a
task is considered done — never accept "tests written" without seeing
real pass/fail output.

## Git commit rules
- Claude Code executes `git add` and `git commit` itself, but only
  after the human has reviewed and explicitly approved the diff shown
  in the VS Code panel. Never commit unreviewed changes.
- One commit per completed unit of work (one pipeline stage, one
  adapter, one component) — never a batch of unrelated changes.
- Message format: Conventional Commits, imperative mood.
  `feat(extraction): add PDF adapter with offset-linked blocks`
- Never add AI attribution of any kind: no "Generated with Claude
  Code" line, no "Co-Authored-By: Claude" trailer, no footer
  referencing Claude or Anthropic. Commits must read as authored by
  the human alone — a deliberate project decision, not an oversight.
- AI assistance is disclosed once, at the process level, in
  README.md — not repeated per commit.

## Tool permission notes
- Claude Code will prompt for permission the first time it runs a new
  category of command (installing a package, running git commit,
  etc.). Approve deliberately, don't blanket-allow everything up
  front — the friction is a feature during the first few sessions.
- `ANTHROPIC_API_KEY` must live only in `.env.local` and in Vercel's
  environment variable settings — never in shell profile files
  (`.zshrc`, `.bashrc`). If it's exported in the shell, Claude Code
  will authenticate via API billing instead of the Pro subscription
  plan, silently spending API credits instead of subscription usage.
  Run `/status` in Claude Code at the start of a session to confirm
  it's running on subscription, not API key.

## Session discipline
- Always check PLAN.md at the start of a session for current phase
  and task status.
- Work one task at a time. Stop and present the diff for review
  before moving to the next task, even within the same phase.
- If a task turns out to need a decision not covered in docs/*.md,
  stop and ask — don't assume and proceed.