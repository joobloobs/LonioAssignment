---
description: "Run only the extraction stage: reverse-engineer a calculator into notes + draft SPEC + vendor fixtures, ending at the spec-approval gate."
argument-hint: "<canton-id> <calculator-url-or-bundle-path>"
---

Launch the **canton-extractor** subagent for: $ARGUMENTS

When it finishes, present its draft SPEC summary and open questions to the
developer and stop at the approval gate (Gate 1 of /add-canton). Do not start
implementation.
