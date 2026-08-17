# engine-core — agent context

The canton-agnostic engine. It interprets question flows and evaluates answer
documents. **It knows nothing about any canton and must stay that way** — no ZH
identifier, no tariff letter, no German string may appear in this package.

Purity: no I/O, no React/Next, no database, no `process`. The ESLint purity block
(`packages/*/src/**/*.ts` in `eslint.config.mjs`) makes a violation a build error.

## The contracts other code depends on

- **`evaluate(module, raw)` pipeline order** — schema parse → stale check →
  completeness check → `computeTariff`. The order is load-bearing: a stale document
  must never reach compute, and an incomplete one must never produce an outcome.
  The result is always a value (`EvaluationResult` union), never an exception.
- **Stale law** — a document is valid iff `answeredKeys ⊆ reachableKeys`. This is the
  generalization of Zurich's per-branch `consumed`-field bookkeeping; it is defined
  here exactly once and every canton inherits it.
- **Lexical scoping in conditions** — `resolveKey` searches innermost scope outward,
  so a condition inside a repeating-group item can reference a top-level answer
  (Zurich's per-child questions branch on the parent's civil status).
- **`incomplete.missingKeys` drives the UI.** The form renderer decides what to show
  from the same evaluation the server runs. Changing this changes form behavior.
- **`enumerateComplete`** must remain exhaustive over reachable documents and bounded
  by `maxRepeat`, because the behavioral snapshot and the differential harness are
  built on it. A bug that *shrinks* the enumeration silently weakens every canton's
  regression contract — treat its tests as safety-critical.

## Changing this package

Any change to the condition AST or the evaluate semantics is an architectural
decision, not an implementation detail: it affects every canton simultaneously and
needs a human decision plus an ADR (see `docs/adr-declarative-flow-typed-compute.md`).
A canton implementer must never edit this package — if a canton's rules don't fit
the condition AST, stop and report it rather than widening the AST unilaterally.

After any change here, every canton's snapshot and differential run must still pass;
those suites are the real test of this package.
