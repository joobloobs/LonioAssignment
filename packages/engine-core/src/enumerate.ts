import type { AnswersDoc, QuestionFlow } from "./types";
import type { Scope } from "./conditions";
import { analyzeWithChain, chainAtPath, nodeAtPath, parsePath, setAtPath } from "./analyze";

export interface EnumerateOptions {
  /** Upper bound on repeatingGroup item count explored (default 2). */
  maxRepeat?: number;
}

function* multisets(variantCount: number, size: number, start = 0): Generator<number[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = start; i < variantCount; i++) {
    for (const rest of multisets(variantCount, size - 1, i)) {
      yield [i, ...rest];
    }
  }
}

function enumerateFlow(
  flow: QuestionFlow,
  outerChain: readonly Scope[],
  maxRepeat: number,
): AnswersDoc[] {
  const results: AnswersDoc[] = [];

  const dfs = (doc: AnswersDoc): void => {
    const a = analyzeWithChain(flow, doc, outerChain);
    if (a.stale.length > 0) {
      throw new Error(`Enumerator produced a stale document at: ${a.stale.join(", ")}`);
    }
    const target = a.missing[0];
    if (target === undefined) {
      results.push(doc);
      return;
    }
    const segments = parsePath(target);
    const node = nodeAtPath(flow, segments);
    switch (node.kind) {
      case "boolean":
        for (const v of [true, false]) dfs(setAtPath(doc, segments, v));
        break;
      case "enum":
        for (const opt of node.options) dfs(setAtPath(doc, segments, opt.value));
        break;
      case "repeatingGroup": {
        const containerChain = chainAtPath(flow, doc, segments.slice(0, -1));
        const variants = enumerateFlow(node.itemFlow, [...outerChain, ...containerChain], maxRepeat);
        const maxCount = Math.min(node.maxItems, Math.max(node.minItems, maxRepeat));
        for (let n = node.minItems; n <= maxCount; n++) {
          for (const combo of multisets(variants.length, n)) {
            const items = combo.map((i) => variants[i] as AnswersDoc);
            dfs(setAtPath(doc, segments, items));
          }
        }
        break;
      }
      case "group":
        throw new Error(`Unexpected missing path resolved to a group: ${target}`);
    }
  };

  dfs({});
  return results;
}

/**
 * Enumerates every reachable, complete answer document for a flow. Feasible
 * because canton flows are small (booleans and short enums); repeating groups
 * are explored as multisets up to maxRepeat items.
 */
export function enumerateComplete(flow: QuestionFlow, opts?: EnumerateOptions): AnswersDoc[] {
  return enumerateFlow(flow, [], opts?.maxRepeat ?? 2);
}
