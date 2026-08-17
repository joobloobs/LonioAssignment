# AI Development Workflow

How AI agents build and maintain this system — the roster, the codified workflows,
the playbooks for the known futures, and the guardrails. The governing decision is
[adr-spec-centric-ai-pipeline](adr-spec-centric-ai-pipeline.md); the verification
backbone is [adr-exhaustive-behavioral-snapshot](adr-exhaustive-behavioral-snapshot.md).

## Principles

1. **Specs are the durable asset; code is a regenerable rendering.** Every canton's
   rules exist as a human-approved `SPEC.md` with evidence-linked extraction notes
   behind it. Agents implement *from the spec*; when reality changes, the spec diff —
   not a code diff — is what humans review first.
2. **Loops are closed by deterministic oracles, never by LLM opinion.** The compiler,
   the fixture corpus, the behavioral snapshot, and the vendor's own executable code
   decide whether an agent is done. LLM review exists as a pre-filter, not authority
   — LLM errors are correlated, so an agent approving an agent is weak evidence.
3. **The contract an agent is tested against is read-only to that agent.** The
   implementer cannot edit specs or fixtures; "make the test pass" can never resolve
   to "change the test".
4. **Narrow workspaces.** The package architecture gives each agent a physically
   bounded blast radius: a canton implementer works inside `packages/canton-xx` and
   cannot reach the database, the UI, or another canton.
5. **Human attention only where it is irreplaceable**: approving what the rules *are*
   (spec gate) and what a change *does* (behavioral-diff gate).

## Direct answer: are several agents with loops a good idea?

**Specialized agents in a pipeline — yes. Free-running multi-agent loops — no.**

Yes to: distinct roles (extract / implement / verify / security-review) with fresh
context per role, artifact handoffs between them, and per-agent iteration loops of
the form *edit → typecheck → test → repeat* with an iteration budget, arbitrated by
oracles the agent can't touch. Fresh context per role is the point: the verifier
re-derives expectations from the spec instead of inheriting the implementer's
assumptions. Parallelism is used where work is truly independent — one agent per
canton package scales horizontally with zero shared files.

No to: conversational agent-to-agent critique loops, consensus-of-models as a merge
criterion, and unbounded self-play. They are cost-unbounded, non-reproducible,
unreviewable after the fact, and their stopping condition is a model's opinion of a
model — exactly the correlated-error trap. An agent that exhausts its iteration
budget stops and *reports the conflict* (usually a real spec/implementation
disagreement worth human eyes) rather than thrashing or quietly widening its diff.

## AI assets in the repository

Context is layered so that any agent, human, or future model lands with the right
knowledge at the right scope — this layering *is* the future-proofing:

```
CLAUDE.md                          # constitution: workflow rules, quality bar, task/lessons loop
docs/                              # ADRs + this doc: the "why" agents must not re-litigate
.claude/settings.json              # permission guardrails (deny .env, protect fixtures/specs)
.claude/agents/                    # role definitions (see roster)
.claude/commands|skills/           # codified workflows (see commands)
packages/engine-core/CLAUDE.md     # core invariants: condition AST scope, evaluate pipeline laws
packages/canton-xx/CLAUDE.md       # canton-local: where SPEC/fixtures live, what is read-only
packages/canton-xx/SPEC.md         # the normative contract for this canton (versioned)
packages/canton-xx/fixtures/       # golden cases with provenance (vendor / live-site / curated)
packages/canton-xx/extraction/     # raw evidence with line-referenced notes + CAPTURE.json
tasks/lessons.md                   # correction patterns fed back into agent behavior
```

When the user's future need arrives — "something changed in the tariff calculation" —
no new *kind* of context is invented under pressure: the update playbook, the drift
detector, the spec, and the snapshot diff tooling already exist and compose.

## Agent roster

| Agent (`.claude/agents/`) | Role | Reads | Writes | May not |
|---|---|---|---|---|
| `canton-extractor` | Classify the source (recon), then reverse-engineer a calculator into evidence + draft spec | source bundles, live site (read-only fetch), web search | `packages/canton-<id>/extraction/`, draft `SPEC.md`, vendor fixtures | touch any package's `src/` |
| `canton-implementer` | Turn an approved spec into flow + compute + schema + tests; iterate to green | SPEC.md, fixtures, engine-core docs | `packages/canton-xx/src/`, tests | edit SPEC.md, fixtures, engine-core, other packages |
| `canton-verifier` | Adversarial audit with fresh context: re-read spec, hunt uncovered branches, propose extra edge fixtures, check snapshot coverage | SPEC.md + implementation (never the implementer's conversation) | verification report, *proposed* fixtures (human promotes them) | modify implementation |
| `security-reviewer` | Boundary audit: validation completeness, PII in logs, injection surfaces, dependency risk | whole repo | report | modify code |
| (built-in) Explore/Plan subagents | Research and planning legwork to keep the main context clean | repo | — | — |

## Codified commands

Repeatable procedures are slash commands, not re-invented prompts:

| Command | What it does |
|---|---|
| `/extract-canton <url\|bundle>` | Run the extractor: capture + hash source artifacts, produce line-referenced extraction notes, draft SPEC.md, harvest vendor examples as fixtures. Ends at **human gate 1** (spec approval). |
| `/implement-canton <id>` | Run the implementer against the approved spec; scaffold the package; loop to green on fixtures + snapshot + typecheck within an iteration budget; register in the app. |
| `/verify-canton <id>` | Run the verifier + the full oracle stack (fixtures, snapshot, differential harness where available); emit a coverage/parity report. |
| `/canton-drift <id>` | Fetch the live calculator bundle, hash-compare against the recorded capture; on change, summarize what moved. Runnable manually or as scheduled CI — government sites change silently, so drift detection is pulled, not hoped for. |
| `/update-canton <id>` | The rule-change pipeline: re-extract → **spec diff** (gate 1) → implement on a branch → **behavioral snapshot diff + stored-data recompute report** (gate 2). |
| `/behavior-diff <id> <base-ref>` | Run current and base engine versions over the enumerated corpus (and optionally stored assessments); emit a table of every combination whose outcome changed. |

## Playbooks

### A. Add a new canton (the scale-out story)

0. **Recon** → establish the *source of truth* before anything else. The developer
   either supplies the calculator or delegates the search to the extractor, which
   classifies the source and writes `RECON.md` without extracting.
   **Human gate 0** — confirm the source and accept the oracle strength it implies
   (see below). Nothing downstream is worth more than the oracle it rests on.
1. `/extract-canton` → evidence + draft spec, fixtures with provenance.
2. **Human gate 1** — approve SPEC.md. This is where domain judgment lives; nothing
   downstream can compensate for a wrong spec.
3. `/implement-canton` → package appears; oracles run; registry line added.
4. `/verify-canton` → adversarial report; promote useful proposed fixtures.
5. **Human gate 2** — review the PR: spec, snapshot summary, verifier report.
   Shared code diff must be exactly one registry line — CI asserts the "adding a
   canton touches nothing shared" property mechanically.

Cantons parallelize: N cantons = N independent pipelines with no shared files.

**Oracle strength is a property of the source, not of our code.** Zurich is the
best case — the logic ships in the client bundle, so it can be executed as a
differential oracle over the exhaustive enumeration. Other cantons will be worse,
and the pipeline's job is to make that *visible* rather than uniform:

| Tier | Source | Oracle | Coverage |
|---|---|---|---|
| 1 | logic in the client JS bundle (ZH) | execute their functions offline | exhaustive |
| 2 | server API called per answer | record a corpus once, replay offline in CI | stratified sample |
| 3 | server-rendered postback | browser-automation capture, once | stratified sample |
| 4 | no calculator — PDFs/ordinances only | official worked examples, curated | curated only; needs domain review |

Two invariants hold across all four: the oracle interface is unchanged (*"given an
answer document, what does the authority say?"*), and CI always runs against a
**frozen, committed corpus** — never against a live government server. Only the
capture mechanism differs. Tiers 2–4 must carry their reduced coverage through to
gate 2 so it is reviewed, not discovered later.

### B. The source website changes (the maintenance story)

Trigger: `/canton-drift` (scheduled or manual) reports a changed bundle hash — or a
human just knows.

1. `/update-canton zh` re-runs extraction on the new source.
2. **Spec diff** is generated: "question X added; visibility of Y now also requires
   Z; letter mapping unchanged." Human approves the new SPEC version (gate 1).
3. Implementer updates flow/compute/schema on a branch; version bump (`engineVersion`).
4. Oracles re-run; the **snapshot diff** shows every answer combination whose outcome
   changed — the semantic content of the change, exhaustively.
5. `/behavior-diff` also runs over **stored assessments**: which real employees'
   codes would change under the new engine, which stored answer documents no longer
   validate (question removed/renamed → those employees need re-onboarding).
6. **Human gate 2** — approve semantic diff + data-impact report; merge; run the
   recompute pass ([database-design](database-design.md)); changed outcomes surface
   to HR rather than silently flipping.

Manual-change surface, honestly stated: engine-core only changes if the *shape* of
conditionality outgrows the condition AST (a deliberate, reviewed extension);
renderer only changes for a genuinely new question kind. Everything else is
spec-driven regeneration inside one canton package.

### C. New process type (family allowances — future, documented only)

Same pipeline, one axis wider: the interface gains `processType`, the registry key
becomes `(process, canton)`, assessments gain `process_type`
([adr-canton-plugin-architecture](adr-canton-plugin-architecture.md) records the
migration). The extractor/implementer/verifier roles and gates are unchanged — the
pipeline was designed around "conditional questions + rules from an external
source", which is the shape of every listed future workflow, not around source tax.

### D. Everyday development

Plan mode for non-trivial tasks; plans land in `tasks/todo.md`; corrections feed
`tasks/lessons.md` (per CLAUDE.md); research is delegated to Explore subagents to
keep the main context clean; CI is the merge arbiter regardless of who — human or
agent — authored the diff.

## Guardrails and failure modes

| Risk | Guardrail |
|---|---|
| Agent "fixes" tests/fixtures to match its bug | fixtures + SPEC.md read-only to implementer (permissions) + CI check: implementation PRs may not touch them |
| Plausible-but-wrong logic survives review | exhaustive snapshot + vendor differential run — uncorrelated oracles, not sampled tests |
| Agent thrashes on a spec conflict | iteration budgets; on exhaustion: stop and report, never widen scope |
| Context contamination between roles | fresh context per pipeline stage; verifier never sees implementer reasoning |
| Prompt injection via scraped government content | extractor treats fetched content as data (no instruction-following from source text); vendor code executed only sandboxed/offline in the differential harness |
| Secret/PII leakage to agents | deny-list in `.claude/settings.json` (.env, local DB files); logs redact answer payloads |
| Runaway cost | bounded loops, pipelines over conversations, snapshot diffs make re-runs targeted |
| Silent upstream change | `/canton-drift` scheduled check — change detection is an input to the pipeline, not a surprise |

## What stays human

- Approving specs (gate 1) — what the rules are.
- Approving behavioral diffs and data-impact reports (gate 2) — what a change does.
- ADRs and engine-core contract changes (condition AST, evaluate semantics).
- Security posture and anything touching stored personal data.

Everything else is delegated — which is the point: the humans in this system spend
their judgment exclusively on the two questions machines cannot answer.
