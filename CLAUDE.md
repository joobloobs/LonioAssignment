# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run type-check, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing types — then resolve them
- Zero context switching required from the user

### 7. Ask clarifying questions
- When a big decision needs to be made, you have to ask clarifying questions to really understand the need.
- When several architectures or designes can be made, present them each and ask the user's advice.

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Architecture Decision Records (ADRs)

- Record significant architectural decisions that affect multiple features, establish a lasting pattern, or involve meaningful trade-offs.
- Store each decision in `docs/adr-<kebab-case-topic>.md` so ADRs are easy to find and consistently named.
- Use the title `# ADR: <Decision title>` and these sections: `Status`, `Context`, `Decision`, `Alternatives considered`, and `Consequences`.
- Keep one decision per ADR. Write the reasoning and trade-offs, not an implementation diary.
- Use `Proposed`, `Accepted`, `Superseded`, or `Deprecated` as the status. Never silently rewrite an accepted decision; mark it superseded and link to the replacement ADR.
- Do not create ADRs for routine bug fixes or small local implementation details.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Minimal code impact.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

---

# Context

For information about guideline and requirements of the project, inspect `guideline.md` file.

---

# Project Map & Invariants

Architecture docs and ADRs live in `docs/` — read `docs/architecture-overview.md`
before proposing structural changes; do not re-litigate accepted ADRs.

| Path | What / rules |
|---|---|
| `packages/engine-core` | Canton-agnostic flow interpreter + `evaluate` pipeline. Pure — no I/O, no UI, no env (lint-enforced). Knows nothing about any canton. |
| `packages/canton-zh` | Zurich module. `SPEC.md` is the normative contract; see its `CLAUDE.md` for read-only rules on spec/fixtures. |
| `apps/web` | Next.js app: form renderer, REST API, dashboard, SQLite (Drizzle). The only place with I/O. |
| `extraction_reference/` | Frozen vendor evidence + `CAPTURE.json` drift baseline. Never imported by app code; executed only by the differential test harness. |
| `.claude/agents`, `.claude/commands` | Canton pipeline: `/add-canton`, `/update-canton`, `/canton-drift`, `/behavior-diff`, … Entry points orchestrate subagents with two human gates (spec approval, behavioral-diff review). |

Invariants that must survive any change:

1. Adding a canton touches a new `packages/canton-*` plus ONE registry line in
   `apps/web/src/cantons.ts` — nothing else.
2. The server recomputes tariffs from raw answers; client results are preview only.
3. Behavior changes must show up in the regenerated behavioral snapshot
   (`pnpm snapshot`) and be reviewed as a diff; `engineVersion` bumps with them.
4. Stored `answers` are immutable; derived columns change only via explicit
   recompute, never silently.
5. Verification gate: `pnpm lint && pnpm typecheck && pnpm test` (includes the
   vendor differential run) before claiming anything works.