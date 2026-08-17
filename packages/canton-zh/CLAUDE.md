# canton-zh — agent context

This package is the Canton Zurich tariff module. Read `SPEC.md` first — it is the
normative contract; the raw evidence behind it lives in
`../../extraction_reference/` (line-referenced).

Rules for working here:

- **`SPEC.md` and `fixtures/` are read-only for implementation work.** If a test
  disagrees with the spec, the implementation is wrong or the spec needs a human
  decision — stop and report; never adjust fixtures or spec to make tests pass.
  (Exception: `fixtures/behavior-snapshot.jsonl` is regenerated via `pnpm snapshot`
  when a behavior change is *intended and approved* — the diff is the review artifact.)
- This package depends only on `@lonio-poc/engine-core` and `zod`. No I/O, no UI,
  no persistence — the purity lint enforces it.
- Any behavior change requires: SPEC version bump + `ZH_ENGINE_VERSION` bump +
  regenerated snapshot + green differential run (`pnpm test`).
- Structure: `src/flow.ts` (visibility, SPEC §2) · `src/compute.ts` (decision
  trees, SPEC §3–§5, row-referenced) · `src/schema.ts` (shape only — completeness
  is the engine's job) · `tests/vendor-harness.ts` (runs the vendor bundle as
  oracle; pinned to the frozen artifact).
