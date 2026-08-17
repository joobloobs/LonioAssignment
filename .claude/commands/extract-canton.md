---
description: "Run only the extraction stage: reverse-engineer a calculator into notes + draft SPEC + vendor fixtures, ending at the spec-approval gate."
argument-hint: "<canton-id> <calculator-url-or-bundle-path>"
---

Launch the **canton-extractor** subagent for: $ARGUMENTS

This command assumes the source of truth is already settled. If the developer
has not confirmed which calculator to verify against and what kind of source it
is, run the extractor in **recon mode** first (Stage 0 / Gate 0 of
`/add-canton`) and stop there — extracting from an unverified or unsuitable
source wastes the whole downstream pipeline.

Otherwise run it in **extraction mode** with the confirmed source and tier. When
it finishes, present its draft SPEC summary and open questions to the developer
and stop at the approval gate (Gate 1 of /add-canton). Do not start
implementation.
