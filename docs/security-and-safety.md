# Security & Safety

Threats, controls in the PoC, and what production would add. Two risk families are
unusual here and get explicit treatment: **special-category personal data** and
**AI-agent-specific risks**.

## Data classification — the sharpest fact first

The questionnaire stores **religious affiliation** and civil status. Under the Swiss
FADP (and GDPR), religious affiliation is *special-category* personal data — the
most protected class. This is not incidental: church tax is literally part of the
tariff code. Consequences for the design:

- **Minimization by construction**: the flow collects only fields the tariff
  computation reads — provable, because the consistency proxy test asserts compute
  reads ⊆ flow fields, and the flow contains nothing compute doesn't need.
- **No answer payloads in logs**, ever (log redaction rule; enforced by review and a
  lint rule on the logger wrapper). Logs carry IDs and evaluation *statuses*, not
  answers.
- The dashboard list endpoint returns **derived columns only**; raw answers are
  exposed solely on the detail view that legitimately needs them.
- Production (not PoC): encryption at rest, role-based access, audit log of who
  viewed which employee's answers, retention policy. Documented as deferred.

## Threat model (PoC surfaces)

| # | Threat | Vector | Control (PoC) |
|---|---|---|---|
| 1 | Malicious form input | `POST /api/employees` | zod parsing at the boundary (types, enums, lengths, no unknown keys); engine re-validates answer shape; ORM-parameterized SQL only |
| 2 | Forged tariff result | client submits a computed code | server never accepts a result — it recomputes from raw answers, always |
| 3 | Stored XSS via names/answers | dashboard rendering | React's default escaping; `dangerouslySetInnerHTML` banned by lint; answers rendered as data, never as HTML |
| 4 | IDOR / data exposure | `GET /api/employees/:id` | no auth in PoC (see below) — flagged as the known accepted gap; production control is authN + role check in middleware |
| 5 | SQL injection | repositories | Drizzle parameterization; no string-built SQL permitted |
| 6 | Dependency compromise | npm supply chain | pnpm lockfile committed; minimal dependency set; `pnpm audit` in CI; no postinstall scripts without review |
| 7 | Secrets leakage | repo / agent context | no secrets required by the PoC at all; `.env` pattern + agent deny-list established anyway so the habit exists before the first secret does |
| 8 | Vendor code execution | differential test harness runs the extracted bundle | executed offline, in an isolated worker/process, no network, only in dev/CI — never shipped in or imported by the application runtime |

**The no-auth decision, stated honestly**: the guideline asks for two screens with no
user model; building auth would spend the review budget on undifferentiated work.
The cut is documented, the seam exists (Next middleware wrapping `/api` and the
dashboard routes), and threat #4 above is the explicit cost carried until then.
Nothing else in the design assumes the absence of auth.

## AI-agent-specific risks

These are first-class threats in an AI-built system, mitigated by the workflow
architecture ([adr-spec-centric-ai-pipeline](adr-spec-centric-ai-pipeline.md)):

| Risk | Mitigation |
|---|---|
| **Hallucinated business rules** — plausible tariff logic that matches nothing real | human-approved SPEC with line-referenced evidence; vendor differential oracle; exhaustive snapshot ([adr-exhaustive-behavioral-snapshot](adr-exhaustive-behavioral-snapshot.md)) |
| **Correlated review blindness** — LLM reviewer misses what the LLM author missed | oracles are deterministic and external (vendor code, enumeration); verifier runs fresh-context and only pre-filters, never gates |
| **Test tampering** — agent aligns the test with the bug | SPEC/fixtures read-only to the implementer; CI rejects implementation PRs touching them |
| **Prompt injection from scraped sources** — government page/bundle content steered an agent | extractor treats fetched content strictly as data to analyze; it has no write access to app code; its output is human-reviewed prose (the spec), not executed |
| **Dependency hallucination / typosquatting** — agent installs a near-miss package | lockfile review on any dependency diff; small allow-listed dep set; CI audit |
| **Scope creep by agents** — "helpful" edits outside the task | package-scoped permissions per agent role; CI guard that canton PRs touch only their package + registry line |
| **PII in agent context** — local DB contents fed to a model | agents work against schema + synthetic fixtures; local DB files on the deny-list |

## Operational safety of the *product* logic

Worth naming because it's a compliance tool: the engine's failure mode must never be
"plausible wrong code". The evaluation union enforces this — schema-invalid, stale,
or incomplete inputs yield a typed non-result (surfaced as "cannot determine"), never
a guessed tariff. Recompute after rule changes flags outcome changes to HR rather
than silently rewriting them ([database-design](database-design.md)). A wrong tariff
code is a payroll error with legal consequences for a real employee; the system is
designed to say "I don't know" over being confidently wrong — the same principle the
AI workflow applies to itself.

## Legal/provenance note on the extraction

The source is a publicly served government web application analyzed for
interoperability; extracted vendor code is retained in-repo only as reference
evidence and test oracle, never executed in or shipped with the product runtime.
Fixture files record provenance (vendor example / live-site session / curated) so
every asserted behavior is traceable to its source.
