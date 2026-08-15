# ADR: Exhaustive behavioral snapshot as the regression contract

## Status

Accepted

## Context

The tariff engine is a port of business rules reverse-engineered from a government
calculator. Its correctness cannot be argued from first principles — it is correct
exactly insofar as it matches the source. And it will be modified by AI agents, whose
failure mode is plausible-looking logic changes. The system therefore needs a
regression mechanism that (a) covers the *entire* behavior, not sampled paths,
(b) turns any behavioral change into a reviewable artifact, and (c) does not depend
on an LLM's judgment to detect a regression.

A decisive domain fact makes this feasible: the answer space is tiny. Every input is
a boolean or a small enum; children are a repeated sub-questionnaire. The set of all
*reachable, complete* answer combinations (children capped at 2 — enough to exercise
every pairwise tree interaction, since beyond that children only increment a capped
counter) is on the order of tens of thousands of cases. That is exhaustively
enumerable in milliseconds.

## Decision

For every canton module, CI maintains a **behavioral snapshot**: a generated,
canonically-ordered file mapping every reachable complete answer combination to its
evaluated outcome.

- The enumerator lives in `engine-core` and walks the declarative flow (it needs no
  canton knowledge — reachability makes the space enumerable by construction).
- The snapshot is committed. Any change to flow or compute that alters any outcome
  shows up as a **table diff in the pull request**: exactly which answer
  combinations changed, from what, to what. Behavior changes become impossible to
  make silently — by human or agent.
- Three oracle layers anchor the snapshot to reality, in decreasing strength:
  1. **Vendor differential testing** — the extracted Zurich bundle ships the actual
     decision services and a built-in `examples` array. A test harness executes the
     vendor's own code (sandboxed, offline) over the enumerated corpus and asserts
     our engine agrees everywhere. This is the gold standard: the oracle is the
     government's code, sharing no blind spots with our port or with any LLM.
  2. **Vendor golden fixtures** — the `examples` array as committed fixture tests
     (fast, always-on, survives even if the differential harness is dropped).
  3. **Manual spot checks** against the live calculator, recorded as fixtures with
     provenance notes.
- **Property-based tests** (fast-check) cover the laws the snapshot can't express
  pointwise: output format invariants, "stale answers ⇒ never a result", the
  cross-border letter remap bijection, child-count capping at 9, replacement-income
  independence from civil status/religion/children.

## Alternatives considered

- **Curated example tests only**: standard practice, but sampling — an agent-
  introduced regression in an untested branch passes CI silently. Rejected as the
  primary mechanism (curated cases remain as readable documentation).
- **Differential testing only, no committed snapshot**: proves parity but leaves no
  reviewable artifact in PRs and couples every CI run to the vendor-bundle harness.
  Rejected as sole mechanism; kept as the anchoring layer.
- **100% code-coverage targets**: coverage measures execution, not correctness of
  outcomes; the snapshot subsumes it for the engine. Rejected as a goal (coverage is
  still observed as a smoke signal for non-engine code).

## Consequences

- The review unit for any rule change becomes a semantic diff ("these 214
  combinations now yield L1N instead of B1N") — precisely what the human should be
  approving, and precisely what the rule-change playbook in
  `docs/ai-development-workflow.md` is built around.
- Snapshot files are large-ish generated artifacts in the repo; mitigated by
  canonical ordering (stable diffs), one file per canton, and a summary header
  (case count + content hash) for at-a-glance comparison.
- The enumeration cap (2 children) is a documented, deliberate bound; the
  linear-beyond-cap behavior is covered by property tests.
- Running the vendor bundle requires a small extraction shim around the webpack
  closures; if that proves brittle it degrades gracefully to layers 2–3 without
  changing the architecture.
