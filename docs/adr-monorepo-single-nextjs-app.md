# ADR: Monorepo with a single Next.js app and pure domain packages

## Status

Accepted

## Context

The guideline mandates full-stack TypeScript with React on the frontend and Next.js on
the backend, and asks for one clonable, runnable repository. The user-facing framing of
"one folder for frontend, one folder for backend" must be reconciled with the fact that
Next.js is *both*: its React components are the frontend and its route handlers are the
Node.js backend.

The single most important requirement is that the tariff computation is **one function
used by both the onboarding form and the HR dashboard** — it must run in the browser
(live conditional flow, instant tariff preview) and on the server (the authoritative
computation). The crown jewel of the system is therefore not frontend or backend code;
it is an isomorphic, pure domain package.

## Decision

pnpm-workspace monorepo, structured by **layer**, not by frontend/backend:

```
apps/web            → the single Next.js app (App Router)
                      - React UI (onboarding form, HR dashboard)
                      - route handlers under /api (the Node backend)
                      - server-only modules (repositories, services) in src/server
packages/engine-core → pure TS: module interface, flow interpreter, reachability,
                       evaluation pipeline, registry types. Zero I/O, zero React,
                       zero canton knowledge.
packages/canton-zh   → the Zurich tariff module: flow definition, compute function,
                       answer schema, SPEC.md, golden fixtures. Depends only on
                       engine-core.
```

Supporting choices bundled with this decision:

- **API style: REST route handlers** (`/api/employees`, …) with zod-validated request/
  response contracts shared between client and server. Route handlers give an explicit,
  independently testable boundary and keep the door open for future non-Next clients
  (mobile, integrations) — relevant for a compliance platform.
- **Package boundaries are dependency-direction contracts**: `engine-core` imports
  nothing from cantons; cantons import only `engine-core`; only `apps/web` assembles
  the canton registry. Enforced by package.json dependencies (a canton physically
  cannot import the app).
- pnpm workspaces only; no Nx/Turborepo until build times justify it.
- One shared strict `tsconfig` (`strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`) inherited by all packages.

## Alternatives considered

- **Separate React SPA + Next.js API service (`apps/frontend` + `apps/backend`)** —
  matches the literal "two folders" mental model, but costs two dev servers, CORS,
  duplicated tooling, and a deployment story the guideline doesn't ask for, while
  buying nothing: the meaningful separation (UI vs domain logic vs persistence) is
  already achieved by the packages. Rejected for the PoC; the engine packages would
  survive such a split unchanged if it ever became necessary.
- **Single Next.js app, no packages (logic in `src/lib`)** — fewer moving parts, but
  the "canton module cannot depend on the app" rule would be convention instead of a
  hard boundary, and the future-canton story ("add a package, touch nothing else")
  would be a claim rather than a demonstrated property. Rejected.
- **Server Actions instead of REST route handlers** — idiomatic modern Next.js and
  end-to-end typed, but the boundary is implicit, harder to test in isolation, and
  couples any future client to Next.js. Rejected for the primary API; may still be
  used for trivial mutations if convenient.

## Consequences

- Adding a canton is a new package + one registry entry in `apps/web` (see
  [adr-canton-plugin-architecture](adr-canton-plugin-architecture.md)).
- The engine runs identically in browser and server; client-side results are treated
  as preview only, the server recomputes on submission (see security doc).
- AI agents get sharply scoped workspaces: a canton-implementation agent operates
  inside `packages/canton-*` and physically cannot reach the database or UI.
- Slight workspace overhead (three package.json files, workspace config) — accepted.
