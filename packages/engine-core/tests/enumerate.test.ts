import { describe, expect, it } from "vitest";
import { analyze, enumerateComplete } from "../src/index";
import { testFlow } from "./flow.fixture";

describe("enumerateComplete", () => {
  const docs = enumerateComplete(testFlow, { maxRepeat: 2 });

  it("enumerates exactly the reachable complete answer space", () => {
    // Hand-counted: a=true → 10 (b=true: mode one→3 grp variants ×2 final,
    // mode two→2; b=false→2); a=false → 3 item variants → 3+6 multisets ×2 final = 18.
    expect(docs).toHaveLength(28);
  });

  it("produces only complete, stale-free documents", () => {
    for (const doc of docs) {
      const a = analyze(testFlow, doc);
      expect(a.missing).toEqual([]);
      expect(a.stale).toEqual([]);
    }
  });

  it("produces no duplicates and is deterministic", () => {
    const canon = docs.map((d) => JSON.stringify(d));
    expect(new Set(canon).size).toBe(docs.length);
    const again = enumerateComplete(testFlow, { maxRepeat: 2 }).map((d) => JSON.stringify(d));
    expect(again).toEqual(canon);
  });
});
