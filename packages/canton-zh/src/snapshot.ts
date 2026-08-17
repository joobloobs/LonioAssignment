import { enumerateComplete, evaluate } from "@lonio-poc/engine-core";
import { zhModule, ZH_ENGINE_VERSION } from "./index";
import { zhFlow } from "./flow";

type Json = boolean | number | string | null | Json[] | { [k: string]: Json };

export function canonicalStringify(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalStringify(value[k] as Json)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * The behavioral snapshot: every reachable complete answer document (≤2
 * children — SPEC §8) mapped to its outcome, one canonical JSON line each.
 * Committed to fixtures/behavior-snapshot.jsonl; any behavior change appears
 * as a reviewable line diff.
 */
export function buildSnapshotLines(): string[] {
  const docs = enumerateComplete(zhFlow, { maxRepeat: 2 });
  const lines = docs.map((doc) => {
    const r = evaluate(zhModule, doc);
    if (r.status !== "complete") {
      throw new Error(`Enumerated document did not evaluate to complete: ${r.status}`);
    }
    return canonicalStringify({ answers: doc, outcome: r.outcome } as unknown as Json);
  });
  const header = canonicalStringify({ spec: ZH_ENGINE_VERSION, cases: lines.length });
  return [header, ...lines];
}
