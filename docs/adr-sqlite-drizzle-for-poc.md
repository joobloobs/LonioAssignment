# ADR: SQLite + Drizzle ORM for the PoC

## Status

Accepted

## Context

The guideline requires a repository reviewers can clone and run, leaves database and
ORM open, and cares about architecture over infrastructure. The data model
([adr-answers-as-versioned-document](adr-answers-as-versioned-document.md)) needs:
two tables, a JSON column, foreign keys, and a migration story. It explicitly does
*not* need concurrency at scale, network access, or operational tooling for the PoC.

## Decision

- **SQLite** (file-based, via `better-sqlite3`) as the PoC database. `pnpm install &&
  pnpm dev` works with zero external services, no Docker, no credentials — the
  clone-and-run requirement dominates every other database concern at this stage.
- **Drizzle ORM** for schema, queries, and migrations. Rationale over alternatives:
  the schema is plain TypeScript (no codegen step, no separate schema language),
  inferred types flow directly into the repository layer, `drizzle-kit` generates SQL
  migrations that are reviewable as SQL, and the same schema definition targets
  Postgres with a driver swap. For AI-agent workflows this matters: the schema is
  ordinary TS that agents read and modify like any other source file, and the
  generated SQL migration is a human-reviewable artifact of every change.
- **Repository layer boundary**: all database access goes through repository modules
  in `apps/web/src/server/`; route handlers never touch Drizzle directly. This is
  what keeps the SQLite→Postgres move (and any ORM regret) a contained change.

## Alternatives considered

- **Postgres (Docker or hosted)**: production-realistic, native JSONB, but adds a
  running dependency to "clone and run" for zero PoC benefit. Deferred — the schema
  and repository layer are written to make this the obvious production migration.
- **Prisma**: excellent DX and a well-known declarative schema file, but adds a
  codegen step and a heavier runtime; Drizzle's plain-TS schema is one less
  representation to keep in sync. Viable; not chosen.
- **No ORM (raw SQL)**: two tables barely justify an ORM, but hand-rolled row mapping
  loses type inference and migration tooling for negligible savings. Rejected.
- **In-memory / JSON-file storage**: fastest to build, but forfeits demonstrating a
  real persistence design, which the assignment evaluates. Rejected.

## Consequences

- Reviewers run the project with no setup; the demo needs no infrastructure.
- SQLite's JSON is stored as text with JSON functions, not indexed JSONB — irrelevant
  at PoC scale; noted as part of the Postgres migration.
- Single-writer characteristics of SQLite are acceptable for a demo and irrelevant to
  the architecture being evaluated.
- The Postgres migration path (driver + dialect swap in Drizzle, JSONB column type,
  same repositories) is documented in `docs/database-design.md`.
