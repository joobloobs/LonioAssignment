---
description: "Full pipeline to add a new canton: recon → source approval → extract → spec approval → implement → verify → review. The developer's single entry point; subagents run automatically between the human gates."
argument-hint: "<canton-id> [calculator-url-or-bundle-path]"
---

Run the add-canton pipeline for: $ARGUMENTS

You are the orchestrator. Execute the stages in order; launch each specialist as
a subagent (Task tool) with ONLY the inputs listed — never share your own
reasoning or a previous agent's conversation with the next one.

## Stage 0 — Source of truth (STOP: human decides first)

**Nothing downstream is worth anything if the oracle is wrong or absent**, so the
pipeline starts by settling *what will serve as ground truth for this canton*.
Do not skip this even when a URL was supplied — a URL says nothing about whether
the logic is extractable.

Ask the developer, plainly, before doing any work:

> Before extracting, we need to establish the source of truth for canton `<id>`
> — the calculator we will verify against. Two options:
>
> **(a) You provide it.** Give me the URL (and, if you already know: does
> answering a question fire a network request, or is the logic in the page's JS
> bundle?).
>
> **(b) I go find it.** I will search for the canton's official calculator,
> classify what kind of source it is, and report back what oracle strength it
> can support — without extracting anything yet.

Wait for the answer.

- If **(a)** and the developer also states the source type, record it and move to
  Gate 0 with their classification.
- If **(a)** with a URL but no classification, or **(b)**, launch
  **canton-extractor in recon mode** with the canton id and whatever is known.
  It classifies the source into one of four tiers and writes
  `packages/canton-<id>/extraction/RECON.md`. It must not extract in this mode.

The tiers, and what they mean for the rest of the pipeline:

| Tier | Source | Oracle | Coverage |
|---|---|---|---|
| 1 | logic in the client JS bundle | execute their functions offline (as ZH) | exhaustive |
| 2 | server API per answer | record a corpus once, replay offline | stratified sample |
| 3 | server-rendered postback | browser-automation capture, once | stratified sample |
| 4 | no calculator (PDF/ordinance only) | official worked examples, curated | curated only |

## Gate 0 — Source approval (STOP: human)

Present the recon findings: candidate source, tier and the evidence for it, the
proposed oracle strategy, the coverage it can achieve, legal/rate-limit notes,
and open risks. Then say explicitly what this costs:

- **Tier 1** — proceed as with Zurich; exhaustive differential verification.
- **Tier 2/3** — proceed, but verification is a stratified sample. Say so, and
  make sure the developer accepts the reduced confidence *before* implementation,
  not at gate 2.
- **Tier 4** — flag that this canton has **no executable oracle**. Gate 1 becomes
  the primary correctness control and likely needs domain-expert review. Ask
  whether to proceed at all.

**Do not proceed until the developer confirms the source and the strategy.**

## Stage 1 — Extraction (automatic)

Launch **canton-extractor in extraction mode** with the canton id, the confirmed
source, and the approved tier. Expected outputs:
`packages/canton-<id>/extraction/` (formatted bundle or recorded corpus +
EXTRACTION-NOTES.md + CAPTURE.json), a draft `packages/canton-<id>/SPEC.md`, and
vendor fixtures.

Everything about a canton lives inside its own package — evidence included.

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
- **the oracle tier and the coverage actually achieved** (exhaustive differential
  run, replayed corpus of N cases, or curated fixtures only) — carry the Gate 0
  caveat all the way through to review,
- the verifier's `VERIFICATION.md` verdict and proposed extra fixtures,
- `git diff --stat` proving shared code changed by exactly one registry line.

Ask whether to promote the verifier's proposed fixtures into
`fixtures/curated.json` (if promoted, re-run the canton tests). Then stop —
committing is the developer's decision.
