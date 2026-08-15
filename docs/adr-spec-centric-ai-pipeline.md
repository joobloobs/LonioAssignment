# ADR: Spec-centric AI pipeline with bounded, oracle-closed loops

## Status

Accepted

## Context

AI agents will do most of the code production in this project, and the guideline
evaluates the workflow as much as the result. The question posed directly: is using
several agents with loops a good idea?

Two observations shape the answer:

1. **LLM errors are correlated.** An LLM reviewing another LLM's port of tariff rules
   shares its blind spots — agent-checks-agent is weak assurance. Deterministic
   oracles (the compiler, the test suite, the vendor's own executable code, the
   exhaustive snapshot) are uncorrelated with the generator and therefore the only
   trustworthy loop-closers.
2. **The durable asset is the spec, not the code.** When the government website
   changes, or a better model ships, code is cheap to regenerate — *if* there is a
   normative, human-approved specification and a behavioral contract to regenerate
   against. Without one, every change is archaeology.

## Decision

**Multiple specialized agents: yes — arranged in a pipeline with artifact handoffs
and human gates, not in conversation with each other.** Each stage consumes a
reviewable artifact and produces the next one:

```
raw source (bundle/site)
  → [extractor agent]      → EXTRACTION-NOTES.md (evidence, line-referenced) + draft SPEC.md
  → [human gate 1]         → approved SPEC.md (the normative contract) + vendor fixtures
  → [implementer agent]    → flow definition + compute + schema + tests in packages/canton-xx
  → [deterministic oracles]→ typecheck, golden fixtures, behavioral snapshot, differential run
  → [verifier agent]       → adversarial audit vs SPEC, extra edge fixtures, coverage report
  → [human gate 2]         → review the semantic diff + verifier report, merge
```

**Loops: yes, but only bounded and oracle-closed.** An agent may iterate
(implement → run tests → fix) any number of times *against a deterministic oracle it
cannot modify*, with an iteration budget; on exhaustion it stops and reports instead
of thrashing. Concretely enforced:

- The **implementer agent may not edit `SPEC.md` or `fixtures/`** — the contract it
  is being tested against is read-only to it (subagent tool permissions + CI check
  that fixture files are untouched by implementation PRs). This closes the classic
  failure of the agent "fixing" the test to match its bug.
- The **verifier agent runs with fresh context** — it never sees the implementer's
  conversation or rationale, only the spec and the code, so it re-derives
  expectations independently rather than confirming them.
- **No free-running agent-to-agent conversation loops.** Rejected because they are
  non-deterministic, unreviewable after the fact, cost-unbounded, and their stopping
  condition is an LLM opinion (see observation 1). Parallelism is used instead where
  work is independent (e.g. one implementer per canton package — no shared files, no
  coordination needed).

**Workflows are codified, not re-prompted.** Repeatable procedures live in the repo
as slash commands / skills (`/extract-canton`, `/implement-canton`, `/verify-canton`,
`/update-canton`, `/canton-drift`, `/behavior-diff`) with agent role definitions in
`.claude/agents/`. Context is layered so any agent lands with what it needs: root
`CLAUDE.md` (project constitution) → package `CLAUDE.md` (local rules) → colocated
`SPEC.md` + extraction notes (domain truth). Details and playbooks:
`docs/ai-development-workflow.md`.

**Humans own exactly two things** in the pipeline: the spec (what the rules *are*)
and the behavioral diff (what the change *does*). Everything between is delegated to
agents and arbitrated by oracles.

## Alternatives considered

- **Single generalist agent, ad-hoc prompting**: works for a one-off, but leaves no
  reusable workflow — the "add canton 3" and "website changed" stories would restart
  from zero each time, which is precisely what this platform must be good at.
  Rejected.
- **Autonomous multi-agent swarm with critique loops** (implementer and reviewer
  agents iterating conversationally to consensus): maximizes compute burned, not
  assurance, for the correlated-error reason above; consensus between copies of the
  same model is not evidence. Rejected.
- **LLM-as-judge as the merge gate**: useful as a *pre-filter* (the verifier agent
  is one), never as the *authority*; authority stays with deterministic oracles and
  the human gates. Partially adopted in that form.

## Consequences

- Every pipeline stage leaves a reviewable artifact; the process is auditable after
  the fact, and any stage can be re-run in isolation when a better model appears.
- Human attention is spent at the two highest-leverage points and nowhere else.
- Building the skills/agent definitions is upfront work that pays off from canton #2
  onward; for canton #1 (ZH) it roughly breaks even — accepted, since the workflow
  itself is a deliverable of this project.
- Iteration budgets mean an agent sometimes stops with failing tests and reports —
  this is the designed behavior (surfacing a real spec/implementation conflict beats
  burning tokens or "fixing" the wrong side).
