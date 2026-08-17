---
description: "Rule-change pipeline for an existing canton after the source website changed: re-extract → spec diff approval → implement on the spec delta → behavioral diff + stored-data impact → review."
argument-hint: "<canton-id>"
---

Run the update-canton pipeline for: $ARGUMENTS

You are the orchestrator. This is the maintenance counterpart of /add-canton;
the review surface is the *diff*, at both gates.

## Stage 1 — Re-extraction (automatic)

Launch **canton-extractor** against the live source for this canton. It captures
the new bundle beside the previous capture (do not overwrite the old one —
version the directory), updates CAPTURE.json, and produces updated extraction
notes plus a REVISED draft SPEC.

## Gate 1 — Spec diff approval (STOP: human)

Produce a semantic diff between the current normative SPEC and the revised
draft: questions added/removed/renamed, visibility changes, decision-table rows
changed, outcome changes. Present it and **wait for approval**. On approval:
bump the SPEC version and `<ID>_ENGINE_VERSION`.

## Stage 2 — Implementation (automatic)

Launch **canton-implementer** with the approved spec delta. Same hard rules as
always: fixtures it may not touch, budget-bounded oracle loop. The behavioral
snapshot WILL change — regenerating it (`pnpm snapshot`) is expected here and
the diff is the deliverable, not a failure.

## Stage 3 — Impact analysis (automatic)

1. Behavioral diff: run `/behavior-diff <canton-id> <base-ref>` logic — summarize
   exactly which answer combinations changed outcome, from what to what.
2. Stored-data impact: for every stored assessment of this canton with an older
   engine_version, re-evaluate its stored answers against the new module and
   report: outcomes that would change (employee, old → new) and answer documents
   that no longer validate (those employees need re-onboarding).
3. Launch **canton-verifier** on the updated package.

## Gate 2 — Review (STOP: human)

Present: spec diff (already approved), snapshot diff summary, stored-data impact
table, verifier verdict, full suite results. The recompute of stored rows and
any commit are the developer's decision — never rewrite stored outcomes
silently.
