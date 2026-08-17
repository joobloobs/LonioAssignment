---
description: "Check whether a canton's government calculator changed since our capture (hash comparison). The trigger for /update-canton."
argument-hint: "<canton-id>"
---

Drift check for canton: $ARGUMENTS

1. Read the capture manifest — `extraction_reference/CAPTURE.json` for ZH (or
   `extraction_reference/<canton>/CAPTURE.json`). It lists the source URL and
   the SHA-256 of each captured file.
2. Fetch each listed file from the live URL (WebFetch or `curl -s`), hash it
   (`sha256sum`), and compare against the manifest.
3. Report per file: `unchanged` or `CHANGED (old → new hash)`.
4. If anything changed: summarize what likely moved (fetch and skim the changed
   bundle for the known symbol names from the extraction notes — renamed or
   missing symbols are the strongest change signal) and recommend running
   `/update-canton <id>`. Do NOT start the update pipeline yourself.
5. If the fetch fails (site down, URL moved), report that as drift of its own —
   a moved URL is a change event.
