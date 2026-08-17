---
description: "Run only the implementation stage for a canton whose SPEC.md is already approved (Status: Normative)."
argument-hint: "<canton-id>"
---

Confirm `packages/canton-$ARGUMENTS/SPEC.md` exists and its status line says
`Normative`. If it does not, stop and tell the developer to run /extract-canton
and approve the spec first.

Then launch the **canton-implementer** subagent for canton $ARGUMENTS and, when
it reports, run `pnpm lint && pnpm typecheck && pnpm test` and summarize the
results plus `git diff --stat`.
