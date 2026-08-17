# Swiss Source-Tax Tariff Platform (PoC)

Full-stack TypeScript proof of concept for the Lonio take-home challenge: an employee
onboarding form with the Canton of Zurich source-tax question flow, and an HR
dashboard showing computed tariff codes (e.g. `B2Y`). The Zurich calculator's logic
was reverse-engineered from its production bundle and reimplemented as a pure,
isomorphic canton module used by both screens.

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:3000 — SQLite database is created automatically
```

Requires Node ≥ 22 and pnpm ≥ 10 (`corepack enable` sets up pnpm).

```bash
pnpm test         # all unit/golden/snapshot/differential tests (51)
pnpm typecheck    # strict TS across the workspace
pnpm lint         # includes the domain-package purity rules
pnpm snapshot     # regenerate the exhaustive behavioral snapshot (canton ZH)
```

## Repository map

| Path | What |
|---|---|
| `apps/web` | Next.js app — onboarding form, HR dashboard, REST API, SQLite via Drizzle |
| `packages/engine-core` | Canton-agnostic engine: question-flow interpreter, reachability, evaluation pipeline, answer-space enumerator |
| `packages/canton-zh` | The Zurich tariff module: `SPEC.md`, declarative flow, typed compute, fixtures, behavioral snapshot, and `extraction/` — the raw reverse-engineering evidence used as test oracle (never shipped) |
| `docs/` | Architecture overview, database design, AI workflow, testing, security + ADRs |
| `.claude/` | AI agent roles and pipeline commands (`/add-canton`, `/update-canton`, …) |
| `tasks/` | Working plan (`todo.md`) and correction log (`lessons.md`) |

Start with [`docs/architecture-overview.md`](docs/architecture-overview.md); every
significant decision has an ADR beside it.

---

## Approach

My very first step was to check the zurich computation website to play around with it,
try out different outcomes to see what was the interactions like and figure out what
the different components were used, especially what type of questions (simple booleans,
enums, groups).

Once I understood more about the tariff logic, I went to see how the zurich website was
doing by inspecting the page. I stumpled unpon the potential js scripts that were potential
candidates for the computation, the problem is that they were compiled in one line
and unreadable as is. I then used claude opus to firstly format the code, and then 
try to extract meaningful and usable information out of it.

The first thing I got was then the extraction reference of the zurich logic and it turned out
everything could be derived from it, the compute function could even be run.

From that I decided to extract the logic thanks to claude and start designing an architecture
taking every aspect into consideration, this was the first phase of implementation :
the docs were the first bricks. I iterated through that and once I was convinced by the design
proposed by claude, I made it implement the app as a second phase of code and verifying everything
outputed in order to be sure I agree and understand the implementation (the only thing that can't
be automated is my own understanding).

## How I used AI

Claude Code (Opus xhigh effort) throughout: plan mode for every non-trivial step (Phase 1 of this
repo is docs-only by design), then specialized subagents with **fresh context per
role** — extractor, implementer, verifier ([`.claude/agents/`](.claude/agents)) —
all of that orchestrated by my top level agent.
The reason I used a big model with xhigh effort it because I consider it way more
efficient in the designin process and when starting from scratch than iterating through
a less efficient model that might introduce more hallucinations or bugs.

I reused a claude.md file that I designed for other projects and adapted it a bit,
the important part inside it is the workflow orchestration.

Maintainability is dispatched by codified slash commands, not re-invented prompts, 
([`.claude/commands/`](.claude/commands)). A developer types one entry point
(`/add-canton`, `/update-canton`) and the rest is semi automatic (the dev is asked what they prefer),
stopping at **two human gates**: approving what the rules *are* (the spec) and what a change *does* (the
behavioral diff). 


## Correctness, security, reliability

Since claude wrote the code, I made sure to be careful with tests, the goal was to use 
different agents to implement the tests as well as the most important : using directly
the government engine to generate test fixtures.

The main one is the zurich bundle itself. `tests/vendor-harness.ts` slices their three
decision services out of the captured script and executes them offline, and the
differential test compares them to my implementation over every answer document the
flow can produce: 8870 combinations, full agreement. Around that, the behavioral
snapshot maps those same combinations to their outcomes so any future behavior change shows up
as a reviewable diff, the golden fixtures cover the vendor's own worked examples plus 18
straightly derived from the spec, and a consistency test runs compute to assert it
only reads fields the flow makes reachable. Strict typescript catches the rest: the
decision trees switch on unions with no default, so a forgotten branch does not compile.

On security ([`docs/security-and-safety.md`](docs/security-and-safety.md)), the main
point is that the server never trusts a tariff computed in the browser, there is no
field for one in the request and it always recomputes from raw answers. The other is
that religious affiliation is special-category data under FADP and GDPR and I cannot
avoid collecting it, since church tax is the last character of the code. The consistency
test doubles as proof that the form collects nothing the tariff does not use, answers
never reach logs, and the dashboard only returns derived columns.
In a production environment, the security would need to be addressed deeper, using Postgres
preferably with RLS, Auth, considering encryption for storage (since the users answers are stored).

For reliability the rule is that the engine says it does not know rather than guess.
`evaluate()` returns a union of `schemaInvalid`, `stale`, `incomplete` and `complete`,
so an under-specified input gives a typed non-result instead of a plausible looking
code. This ensures that client side computation is never trsuted and everything is 
recomputed server side.

## Trade-offs

| Trade-off | Why | Cost |
|---|---|---|
| SQLite + Drizzle, not Postgres | clone-and-run, zero setup | dialect swap later, no auth, no rls |
| One Next.js app monorepo | the domain logic must run identically in browser and server; packages already enforce a stricter boundary | none at this scale |
| No auth | For this delivery that has two screens and no user model, I decided to not use auth but it would need to be added in the HR side | IDOR on the detail endpoint, documented |
| Enumeration bounded at 2 children | a 3rd child adds no new *kind* of path (digit clamps at 9) | not completely exhaustive, only up to the bound |
| No Playwright e2e / renderer tests | engine laws + API tests carry correctness | UI regressions caught by review, not CI |
| English labels only | labels are data in the flow; i18n touches no logic | one language today (could be changed) |

Two things are specified but not built: the recompute pass and stored-data impact report
([`docs/database-design.md`](docs/database-design.md), driven by `/update-canton`), so a
rule change today gives a correct behavioral diff and then needs a manual recompute. 
As for the employee detail screen is the same : the API exists but there is no UI.

## What I'd improve

The recompute pass first, since it is the one place the design is ahead of the code. Then
playwright tests for the demo journeys and renderer tests driven by a synthetic flow,
which is the only way to actually prove the renderer is canton generic. The bigger one is
adding a second canton for real through `/add-canton` — the "new package plus one registry
line" claim is enforced by the architecture and checked in CI, but doing it would probably
reveal a place or two where the engine is maybe specific to zurich. After that, `/canton-drift`
on a schedule (cron job in CI), and auth with audit logging. Lastly, probably turning the database into 
postgre (It is not a big change) to have easy auth handling, RLS, scalability. Having docker setup
would also allow for reproducability and ensuring production env is the same as dev env.

If I started over I would build the differential harness first and write the implementation
against it. I built it after the fact instead of making it the target.
I would also try to fine tune even more my initial agent to ask more questions, I had to 
go through the understanding mostly after it was implemented, it would have been better
to understand and agree fully beforehand.
