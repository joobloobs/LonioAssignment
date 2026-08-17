import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildSnapshotLines } from "../src/snapshot";

describe("behavioral snapshot", () => {
  it("matches the committed fixtures/behavior-snapshot.jsonl (run `pnpm snapshot` after intended behavior changes)", () => {
    const url = new URL("../fixtures/behavior-snapshot.jsonl", import.meta.url);
    const committed = readFileSync(url, "utf8");
    const regenerated = buildSnapshotLines().join("\n") + "\n";
    // String equality keeps the failure actionable: regenerate + git diff shows
    // exactly which answer combinations changed outcome.
    expect(regenerated === committed, "snapshot drift — regenerate and review the diff").toBe(true);
  });
});
