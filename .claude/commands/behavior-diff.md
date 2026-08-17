---
description: "Semantic diff of a canton's behavior between two git refs, based on the committed behavioral snapshot. The review artifact for any rule change."
argument-hint: "<canton-id> <base-ref>"
---

Behavioral diff for: $ARGUMENTS

The committed snapshot (`packages/canton-<id>/fixtures/behavior-snapshot.jsonl`)
maps every reachable complete answer document to its outcome, one canonical JSON
line each — so a line diff IS the behavior diff.

1. Ensure the working-tree snapshot is current: `pnpm snapshot` must produce no
   change (if it does, the snapshot was stale — regenerate first and say so).
2. `git diff <base-ref> -- packages/canton-<id>/fixtures/behavior-snapshot.jsonl`
3. Parse the paired removed/added lines and aggregate into a human-readable
   table: for each (old outcome → new outcome) pair, the number of affected
   answer combinations and 2–3 representative examples described in words
   (e.g. "married, partner employed, 1 counting child, DE cross-border:
   C1Y → N1Y" — not raw JSON).
4. Cases only added (new questions/paths) or only removed are listed separately
   as "new behavior" / "removed behavior".
5. End with the one-line summary: N of M combinations changed outcome.
