# ADR: Cantons as self-contained plugin modules behind one interface

## Status

Accepted

## Context

Today the platform supports exactly one workflow: Zurich source tax. The guideline is
explicit that the future holds more cantons (each with different rules and question
flows) and more HR compliance processes (e.g. family allowances), and that long-term
changeability is the property being evaluated.

The failure mode to avoid is canton logic leaking into shared code: `if (canton ===
'ZH')` branches in the form renderer, per-canton columns in the database, per-canton
endpoints in the API. Every such leak turns "add a canton" into a cross-cutting change
with regression risk in existing cantons.

## Decision

Every canton is a **self-contained module** implementing a single interface defined in
`engine-core`:

```ts
interface TariffModule<A> {
  cantonId: CantonId;            // 'ZH'
  engineVersion: string;         // stored with every computed result
  flow: QuestionFlow;            // declarative question flow (drives the form UI)
  answerSchema: ZodType<A>;      // validates the raw answer document
  computeTariff(answers: A): TariffOutcome;  // pure function, the extracted logic
}
```

A **registry** (assembled only in `apps/web`) maps `CantonId → TariffModule`. Every
shared component is canton-generic:

- The form renderer interprets *any* `QuestionFlow` — it has no Zurich knowledge.
- The API resolves the module from the registry by the employee's canton.
- The database stores answers as a canton-shaped document plus canton-agnostic derived
  columns (see [adr-answers-as-versioned-document](adr-answers-as-versioned-document.md)).
- An unsupported canton is a first-class state ("not yet supported"), not an error.

Each canton package colocates everything an AI agent or human needs to work on it:
`SPEC.md` (the normative rule spec), `fixtures/` (golden cases), the flow definition,
the compute function, tests, and a package-level `CLAUDE.md` pointing at them.

**Definition of done for the architecture**: adding canton N+1 touches (1) a new
`packages/canton-xx` and (2) one registry entry. Nothing else. CI can assert this on
the ZH → second-canton diff one day.

## Alternatives considered

- **One shared engine with per-canton configuration/data only** (pure rules-as-data;
  cantons are JSON files, no canton code) — maximally uniform, but assumes all future
  cantonal logic fits one DSL. Zurich alone already has irregularities (replacement-
  income shortcut, Liechtenstein outcomes that are prose rulings rather than codes).
  Betting the platform on a DSL before seeing a second canton is premature
  generalization. Rejected; the split is refined in
  [adr-declarative-flow-typed-compute](adr-declarative-flow-typed-compute.md).
- **Copy-the-app-per-canton** (each canton is a vertical slice with its own form
  screens) — trivially flexible, catastrophically unmaintainable; every UX fix is
  N changes. Rejected.
- **Generalizing to `ComplianceModule` with a `processType` dimension now** — the
  guideline explicitly says not to build for those scenarios today. The evolution is
  documented instead: the interface gains `processType`, the registry key becomes
  `(processType, cantonId)`, and the assessments table gains a `process_type` column.
  Nothing in today's design blocks that migration. Deferred.

## Consequences

- New cantons scale horizontally: parallel AI agents can each own one canton package
  without merge conflicts in shared code.
- The interface is a contract that shared code is tested against once, not per canton.
- Cost: the interface must be respected even when it feels heavyweight for a simple
  canton; irregular cantonal behavior must be expressed inside the module, never as a
  special case in shared code. That discipline *is* the architecture.
- The first real test of the abstraction arrives with canton #2; the interface may
  need a (versioned, deliberate) revision then — expected and acceptable.
