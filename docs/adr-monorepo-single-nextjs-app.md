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

### Why the directory nesting

`apps/web/src/app/` looks redundant at first glance; it is four segments with four
different owners, only two of which are decisions of ours:

- **`apps/`** — workspace convention, and the load-bearing one. It exists as the
  counterpart to `packages/`: the canton modules living *outside* the application is
  what makes "a canton cannot import the DB or the UI" a property of the dependency
  graph rather than a code-review rule. The alternative (Next app at the repo root,
  `packages/` beside it) makes the root `package.json`/`tsconfig.json` serve double
  duty as both workspace and app manifest, and forces a restructure as soon as a
  second deployable appears — e.g. the scheduled drift-checker or the recompute
  runner from the maintenance playbook.
- **`web/`** — the deployable's name, forced by the plural `apps/`.
- **`src/`** — Next.js convention, pure taste. It keeps the ~6 config files that must
  sit at the package root (`package.json`, `next.config.ts`, `tsconfig.json`,
  `drizzle.config.ts`, `playwright.config.ts`, eslint) separate from code, and gives
  the `@/*` alias a clean target. Droppable at the cost of one tsconfig path.
- **`app/`** — **not a choice**: the App Router's reserved directory. Routing is
  file-system based, so `app/dashboard/page.tsx` *is* the `/dashboard` route and
  `app/api/employees/route.ts` *is* the `POST /api/employees` handler. The collision
  with `apps/` is an unlucky coincidence between pnpm and Next.js conventions; the
  two names mean unrelated things.

Supporting choices bundled with this decision:

- **API style: REST route handlers** (`/api/employees`, …) with zod-validated request/
  response contracts shared between client and server. Route handlers give an explicit,
  independently testable boundary and keep the door open for future non-Next clients
  (mobile, integrations) — relevant for a compliance platform.
- **Package boundaries are dependency-direction contracts**: `engine-core` imports
  nothing from cantons; cantons import only `engine-core`; only `apps/web` assembles
  the canton registry. Enforced by package.json dependencies (a canton physically
  cannot import the app).
- **`apps/` vs `packages/` is a purity boundary, not tidiness**: everything under
  `packages/**` is pure (no `fs`, no database driver, no React, no `process.env`);
  `apps/**` is the only place I/O and rendering are allowed. Because the split is a
  path glob, this is enforceable by an ESLint `no-restricted-imports` rule and
  statable as one line in `CLAUDE.md`. That is what makes the rule survive
  AI-generated changes instead of depending on reviewer vigilance — and it is why
  `apps/` earns its level even while `web` is its only child.
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
