# ADR: Declarative question flow, typed compute function

## Status

Accepted

## Context

A canton module has two responsibilities extracted from the government calculator:

1. **The question flow** — which questions exist, their answer types, and the
   conditional visibility rules ("show `partnerEmployed` only when married and
   religion is answered").
2. **The tariff computation** — the decision logic mapping a complete answer set to a
   tariff outcome (`B2Y`, `Q`, or a special ruling like Liechtenstein's
   "grundsätzlich keine Quellensteuerpflicht").

The Zurich extraction shows these have very different shapes. The visibility rules are
regular and tabular — obviously data. The computation is irregular: two genuinely
different per-child decision trees keyed on marital status, a replacement-income path
that skips civil status/religion/children entirely, a cross-border letter remap
(A→L, B→M, C→N, H→P), and outcomes that are sometimes not codes at all.

The original calculator also implements a subtle correctness mechanism worth keeping:
a **stale-answer guard**. If the user answers a question, then changes an earlier
answer so that question is no longer reachable, the stale answer must invalidate the
result rather than silently contribute. Zurich implements this with hand-maintained
"consumed field" bookkeeping in every branch — effective but error-prone to replicate.

## Decision

Split the two responsibilities by what representation fits each:

**1. The flow is data.** A `QuestionFlow` is a declarative structure interpreted by
shared code: an ordered list of question nodes (`boolean`, `enum`, nested `group`,
`repeatingGroup` for per-child sub-questionnaires), each with a `visibleWhen`
condition expressed in a small predicate AST (`eq`, `answered`, `complete`, `all`,
`any`, `not`). This is what makes the form renderer canton-generic and makes flow
changes reviewable as data diffs.

**2. The compute function is typed TypeScript.** Decision trees are written as pure
functions over a typed answer object, using discriminated unions and exhaustiveness
(`never`) checks. No interpreter is powerful enough for the irregular cases without
becoming a programming language; TypeScript already is one, with a type checker.

**3. The stale-answer guard is derived, not hand-written.** With a declarative flow,
reachability is computable: `reachable(flow, answers)` returns the set of question
keys currently reachable. The guard becomes a single generic rule in `engine-core`:

```
answeredKeys ⊆ reachable(flow, answers)   — otherwise the result is 'stale'
```

This replaces Zurich's per-branch consumed-list bookkeeping with one law that holds
for every canton automatically. The form renderer uses the same computation to prune
newly-unreachable answers when the user edits an earlier one; the server re-checks it
authoritatively on submission.

**4. One evaluation pipeline in `engine-core`** ties it together and is the only
entry point both UIs use:

```
evaluate(module, rawAnswers):
  → schema-invalid (zod errors)
  → stale (keys answered but unreachable)
  → incomplete (reachable keys still unanswered — drives the form's "next question")
  → complete (TariffOutcome from module.computeTariff)
```

returned as a discriminated union — an upgrade over the original's bare `undefined`.

**Consistency between flow and compute is tested, not assumed**: an instrumentation
test runs `computeTariff` over the enumerated answer corpus behind a recording proxy
and asserts that every field the function *reads* is reachable in the flow for those
answers, and that the schema's keys equal the flow's keys. Drift between the three
representations (flow, schema, compute) fails CI.

## Alternatives considered

- **Everything as code** (flow = React conditionals, compute = TS): the form renderer
  stops being generic, every canton means new UI code, flow changes become code
  review of JSX. Rejected.
- **Everything as data** (full rules-engine DSL evaluating outcomes too): single
  source of truth is attractive and re-extraction diffs would be pure data diffs, but
  the DSL must express Zurich's irregularities on day one and every unseen canton's
  irregularities forever — the inner-platform trap. Type-level exhaustiveness
  checking of decision trees is also lost. Rejected now; if canton #3 shows the
  compute functions converging on a common shape, promoting that shape to data is a
  contained refactor because all consumers go through `evaluate`.
- **Deriving the flow from the compute function** (static analysis of field access):
  clever, fragile, unreviewable. Rejected.

## Consequences

- Two artifacts must stay in sync per canton (flow + compute), accepted because the
  sync is machine-checked (proxy test, schema/flow key equality) rather than manual.
- The predicate AST must stay small; if a canton's visibility rule doesn't fit, the
  AST is extended deliberately (a reviewed engine-core change), never bypassed with
  escape hatches in canton code.
- The stale-answer law gives every current and future canton the original
  calculator's most subtle correctness property for free.
- AI agents get ideal targets: flow definitions are data they can generate from a
  spec and humans can review line-by-line; compute functions are code the compiler
  and the fixture corpus hold to account.
