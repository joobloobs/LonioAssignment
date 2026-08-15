# ADR: Raw answers stored as a versioned document; derived results as typed columns

## Status

Accepted

## Context

Each canton asks different questions, so the shape of an employee's questionnaire
answers is canton-specific and will change over time (new cantons, government-side
rule changes). The HR dashboard, in contrast, needs one uniform, queryable thing per
employee: the tariff outcome.

Two facts drive the design:

- **Answers are the source of truth; the tariff code is derived.** If the engine is
  ever fixed or the rules change, stored codes can be recomputed from stored answers.
  The reverse is not possible.
- **Relational-izing per-canton questions kills changeability.** If ZH answers were
  columns, every new canton and every government-side question change would be a
  schema migration touching shared infrastructure — exactly the coupling the plugin
  architecture exists to prevent.

## Decision

The `tariff_assessments` table stores, per employee:

- `answers` — the raw answer document as JSON, exactly the object the canton module's
  zod schema validated. Canton-shaped, schema-checked at the boundary, opaque to SQL.
- `canton` + `engine_version` — which module, at which version, produced the result.
  This makes every stored result auditable and reproducible, and identifies which
  rows need recomputation when a canton engine is updated.
- Derived, canton-agnostic result columns for the dashboard to query directly:
  `tariff_code` (nullable — e.g. `B2Y`, `Q`), `special_ruling` (nullable prose
  outcome, e.g. the Liechtenstein no-liability ruling), `remark`, `computed_at`.

Invariants:

- The server only persists assessments whose evaluation status is `complete`; the
  derived columns are always consistent with `answers` under `engine_version` at
  write time.
- When a canton engine version changes, a recompute pass re-derives the columns from
  `answers` and flags changed outcomes for HR review (see the rule-change playbook in
  `docs/ai-development-workflow.md`). Stored answers are never mutated by recompute.
- The database schema is **canton-invariant**: adding a canton adds zero tables and
  zero columns.

## Alternatives considered

- **Fully relational answers** (`answer_values` EAV table or per-canton columns):
  EAV gives SQL access to individual answers but loses the document's atomicity and
  types, and reconstructing an answer set for recompute becomes a join exercise;
  per-canton columns cause the migration coupling described above. Rejected — no
  current query needs answer-level SQL; if analytics ever do, generated columns or a
  projection table can be added without changing the source of truth.
- **Storing only the computed code, discarding answers**: smallest footprint, but
  destroys auditability and recomputability — untenable for a compliance product.
  Rejected.
- **Computing on read instead of storing results**: always fresh, but the dashboard
  would silently change historical results when the engine changes — in compliance,
  a result change must be an explicit, reviewable event, not a side effect of a
  deploy. Rejected; recompute is an explicit versioned pass instead.
- **Append-only determination history table** (every recompute appends, nothing
  overwritten): the right production design for audit trails, deferred for the PoC.
  The current shape (answers immutable + engine_version on the row) preserves the
  information needed to adopt it later.

## Consequences

- No SQL-level integrity on answer contents — accepted; integrity lives in the zod
  schema and the engine's evaluation pipeline, which are enforced at every write.
- Old answer documents may predate a flow change. `engine_version` on the row makes
  such rows detectable; the recompute pass reports rows whose answers no longer
  validate (a real-world signal that affected employees must be re-asked, which is a
  product workflow, not a data bug).
- Works identically on SQLite (PoC) and Postgres JSONB (production path) — see
  [adr-sqlite-drizzle-for-poc](adr-sqlite-drizzle-for-poc.md).
