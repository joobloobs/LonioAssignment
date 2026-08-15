# Todo — Phase 1: Architecture & AI-Workflow Decisions (docs only, no implementation)

Goal: produce the decision documentation for the Lonio take-home PoC (Swiss source-tax
tariff platform), covering system architecture, database design, AI agent workflow,
testing strategy, and security — all high level, grounded in `guideline.md` and
`extraction_reference/EXTRACTION-NOTES.md`.

## Plan

- [x] Read `guideline.md` and `extraction_reference/` (notes + spot-check bundle)
- [x] `docs/architecture-overview.md` — system design, component/class/sequence UML, folder layout
- [x] `docs/database-design.md` — ER diagram, storage decisions, versioning/recompute strategy
- [x] `docs/ai-development-workflow.md` — agent roster, commands, playbooks (new canton, rule change), loops stance
- [x] `docs/testing-strategy.md` — oracle strategy, test pyramid, CI gates
- [x] `docs/security-and-safety.md` — threat model, PII (incl. special-category data), AI-specific risks
- [x] ADR: monorepo + single Next.js app (`docs/adr-monorepo-single-nextjs-app.md`)
- [x] ADR: canton plugin architecture (`docs/adr-canton-plugin-architecture.md`)
- [x] ADR: declarative flow + typed compute (`docs/adr-declarative-flow-typed-compute.md`)
- [x] ADR: answers as versioned document (`docs/adr-answers-as-versioned-document.md`)
- [x] ADR: SQLite + Drizzle for PoC (`docs/adr-sqlite-drizzle-for-poc.md`)
- [x] ADR: spec-centric AI pipeline with bounded loops (`docs/adr-spec-centric-ai-pipeline.md`)
- [x] ADR: exhaustive behavioral snapshot (`docs/adr-exhaustive-behavioral-snapshot.md`)
- [x] Review section below

## Review

12 documents produced (5 design docs + 7 ADRs), no code. The load-bearing decisions:

1. **Canton = plugin package** behind one `TariffModule` interface; shared code is
   canton-generic; adding a canton touches a new package + one registry line, and CI
   will assert that property.
2. **Flow as data, compute as typed TS** — the split follows the shape of the
   extracted Zurich logic (regular visibility rules vs irregular decision trees).
   The stale-answer guard becomes a derived law (`answered ⊆ reachable`) instead of
   Zurich's per-branch bookkeeping.
3. **Answers stored as versioned JSON document + derived typed columns** — DB schema
   is canton-invariant; recompute after engine changes is an explicit, reported pass.
4. **Correctness rests on uncorrelated oracles**: vendor bundle run as differential
   ground truth, vendor fixtures, and a committed exhaustive behavioral snapshot
   (feasible because the answer space is tiny) that turns every behavior change into
   a reviewable table diff.
5. **AI workflow = pipeline of specialized agents with two human gates** (spec
   approval, behavioral-diff approval); loops allowed only when bounded and closed
   by deterministic oracles; no free-running agent-to-agent conversation.

Open items deliberately deferred to Phase 2 (implementation): condition-AST final
shape, exact snapshot file format, whether the vendor-bundle differential shim is
practical (graceful degradation documented if not).

## Phase 2 (next, after user review of the docs)

- [ ] Scaffold monorepo (pnpm workspaces, strict tsconfig, apps/web, packages)
- [ ] Write `.claude/agents/` + commands from the workflow doc
- [ ] `/extract-canton` output → `packages/canton-zh/SPEC.md` from existing notes (human gate 1)
- [ ] Implement engine-core (condition AST, reachability, evaluate, enumerator)
- [ ] Implement canton-zh from SPEC + fixtures
- [ ] App: flow renderer, API, dashboard, DB
- [ ] Oracle stack: fixtures, snapshot, differential harness
