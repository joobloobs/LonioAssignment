---
description: "Run the adversarial verification stage plus the full oracle suite for a canton; produces VERIFICATION.md."
argument-hint: "<canton-id>"
---

1. Launch the **canton-verifier** subagent (fresh context) for canton $ARGUMENTS.
2. Run the deterministic oracles yourself:
   `pnpm lint && pnpm typecheck && pnpm --filter @lonio-poc/canton-$ARGUMENTS test`
3. Report: oracle results, the verifier's verdict from
   `packages/canton-$ARGUMENTS/VERIFICATION.md`, and any proposed fixtures the
   developer may want to promote into `fixtures/curated.json`.
