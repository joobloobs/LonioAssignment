# Testing Strategy

What guarantees correctness in a system whose core logic is (a) reverse-engineered
from an external source and (b) largely written by AI agents. The cornerstone
decision is [adr-exhaustive-behavioral-snapshot](adr-exhaustive-behavioral-snapshot.md).

## The central problem: what is the oracle?

The engine is a port. "Correct" means "agrees with the Canton of Zurich's
calculator". Ordinary example-based tests written by the same process that wrote the
code (an LLM) inherit its blind spots. The strategy is therefore built on oracles
that are **uncorrelated with the implementation**, ordered by strength:

| Oracle | Nature | Role |
|---|---|---|
| Vendor bundle, executed | the government's own decision services (`_l`, `El`, `Zl`) run headlessly, sandboxed, over our generated cases | differential ground truth — strongest possible anchor |
| Vendor `examples` fixtures | worked examples shipped inside the bundle | fast, always-on golden tests with official provenance |
| Live-site spot checks | manually recorded sessions on the real calculator | provenance-stamped fixtures for a handful of tricky paths (LI branches, replacement income) |
| Exhaustive behavioral snapshot | committed enumeration of every reachable complete answer set → outcome | the regression contract: any behavior change is a visible table diff |
| Property-based tests (fast-check) | invariant laws | covers what pointwise cases can't state |

Feasibility note: the reachable answer space (booleans + small enums, children capped
at 2 — beyond that children only increment a capped counter) is tens of thousands of
cases; enumeration is milliseconds, so "exhaustive" is literal, not aspirational.

## Test layers (bottom-up)

### 1. Type safety as the first test suite

Strict TS everywhere (`strict`, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`), no `any`/`as` escapes (lint-enforced), discriminated
unions with `never`-exhaustiveness for civil status, question kinds, outcomes.
A whole class of tariff-tree bugs (unhandled branch, impossible state) is made
uncompilable rather than tested for.

### 2. Engine unit + law tests (`engine-core`)

- Condition AST evaluation; reachability over nested groups/repeating groups.
- Evaluation pipeline laws: stale answers ⇒ `stale`, never a result (the ported
  purity guard); missing reachable answers ⇒ `incomplete` with exactly those keys.
- **Flow/compute/schema consistency (mechanical, per canton)**: run `computeTariff`
  over the enumerated corpus behind a recording proxy and assert *fields read ⊆
  fields reachable*; assert schema keys ≡ flow keys. The three per-canton artifacts
  cannot drift without failing CI.

### 3. Canton behavior tests (`canton-zh`)

Golden fixtures (vendor + curated + verifier-proposed), the behavioral snapshot, the
differential harness, and property tests: outcome format invariant, cross-border
remap A→L/B→M/C→N/H→P applied exactly when `boarderCrosser`, child digit ≤ 9,
replacement-income outcomes (`G`/`Q`) independent of civil status/religion/children,
married vs unmarried child-trees genuinely diverging on the known cases.

### 4. Contract & API tests (`apps/web`)

Route handlers tested against the zod DTOs with an in-memory/temp SQLite: happy
path, schema-invalid 4xx, stale/incomplete 422 with keys, unsupported canton,
Swiss short-circuit (no assessment row), upsert-on-resubmission, and the invariant
that the server ignores any client-supplied tariff result.

### 5. Form renderer component tests

Testing Library, driven by a small *synthetic test flow* (not ZH — the renderer must
be proven canton-generic): conditional appearance, answer pruning when an earlier
answer changes, repeating-group add/remove, error surfacing from `EvaluationResult`.
Because renderer visibility and engine semantics are the same `evaluate` call,
these tests are UI-behavior tests, not logic re-tests.

### 6. End-to-end (Playwright)

Few and journey-shaped, matching the demo script: Swiss employee (short flow, no
questionnaire), married cross-border German commuter (full flow → expected code on
dashboard), replacement income (shortcut path), an edit-earlier-answer flow proving
stale pruning in the real UI.

## CI pipeline (merge gate, identical for human and agent PRs)

```
typecheck → lint → engine + canton tests (incl. snapshot compare) →
consistency proxy tests → API/component tests → e2e (chromium) →
guard checks: fixtures/SPEC untouched by implementation PRs;
             canton PRs touch no shared code beyond the registry line
```

Differential harness runs on demand and on canton-change PRs (it needs the captured
bundle, not the network).

## Deliberately not tested in the PoC

Load/perf (no scale requirement), full a11y audit (axe smoke check only),
cross-browser matrix (chromium only), penetration testing (threat model documented
instead — see [security-and-safety](security-and-safety.md)). Each is a scope
decision, not an oversight.
