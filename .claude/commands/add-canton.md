---
description: "Full pipeline to add a new canton: extract → spec approval → implement → verify → review. The developer's single entry point; subagents run automatically between the two human gates."
argument-hint: "<canton-id> <calculator-url-or-bundle-path>"
---

Run the add-canton pipeline for: $ARGUMENTS

You are the orchestrator. Execute the stages in order; launch each specialist as
a subagent (Task tool) with ONLY the inputs listed — never share your own
reasoning or a previous agent's conversation with the next one.

## Stage 1 — Extraction (automatic)

Launch **canton-extractor** with the canton id and source. Expected outputs:
`extraction_reference/<canton>/` (formatted bundle + EXTRACTION-NOTES.md +
CAPTURE.json), a draft `packages/canton-<id>/SPEC.md`, and vendor fixtures.

## Gate 1 — Spec approval (STOP: human)

Present to the developer: the draft SPEC summary, the extractor's open
questions, and where the evidence lives. Ask explicitly for approval or edits.
**Do not proceed until the developer approves the SPEC.** Record approval by
setting the SPEC status line to `Status: Normative`.

## Stage 2 — Implementation (automatic)

Launch **canton-implementer** for the canton. It scaffolds the package from the
canton-zh template, implements flow/compute/schema/tests, generates the
behavioral snapshot, adds the registry line, and iterates until the oracles are
green (or stops with a report if the spec conflicts — bring that back to the
developer, that is a Gate 1 regression, not something to fix silently).

## Stage 3 — Verification (automatic)

Launch **canton-verifier** (fresh context) for the canton. Then run the full
suite yourself: `pnpm lint && pnpm typecheck && pnpm test`.

## Gate 2 — Review (STOP: human)

Present to the developer:
- test/lint/typecheck results,
- the snapshot summary line (case count) and where the file lives,
- the verifier's `VERIFICATION.md` verdict and proposed extra fixtures,
- `git diff --stat` proving shared code changed by exactly one registry line.

Ask whether to promote the verifier's proposed fixtures into
`fixtures/curated.json` (if promoted, re-run the canton tests). Then stop —
committing is the developer's decision.
