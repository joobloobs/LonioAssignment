import type { AnswerPrimitive, AnswersDoc, Condition, QuestionFlow, QuestionNode } from "./types";

/**
 * A scope pairs a flow with the answer document it describes. Conditions are
 * evaluated against a chain of scopes (outermost first); keys resolve lexically:
 * the innermost flow that *declares* the key wins, regardless of what the
 * document happens to contain.
 */
export interface Scope {
  flow: QuestionFlow;
  doc: AnswersDoc;
}

export function declaredNode(flow: QuestionFlow, key: string): QuestionNode | undefined {
  return flow.nodes.find((n) => n.key === key);
}

export interface KeyResolution {
  scopeIndex: number;
  node: QuestionNode;
  value: AnswersDoc[string];
}

export function resolveKey(key: string, chain: readonly Scope[]): KeyResolution | undefined {
  for (let i = chain.length - 1; i >= 0; i--) {
    const scope = chain[i];
    if (!scope) continue;
    const node = declaredNode(scope.flow, key);
    if (node) return { scopeIndex: i, node, value: scope.doc[key] };
  }
  return undefined;
}

function primitiveAt(key: string, chain: readonly Scope[]): AnswerPrimitive | undefined {
  const res = resolveKey(key, chain);
  if (!res) return undefined;
  const v = res.value;
  return typeof v === "boolean" || typeof v === "string" ? v : undefined;
}

/**
 * `complete(key)` is vacuously true when the referenced node is not currently
 * visible — mirroring the source calculator, where an empty child list counts
 * as "all child questionnaires completed".
 */
export type SubtreeCompleteFn = (res: KeyResolution, chain: readonly Scope[]) => boolean;

export function evalCondition(
  cond: Condition,
  chain: readonly Scope[],
  subtreeComplete: SubtreeCompleteFn,
): boolean {
  switch (cond.type) {
    case "eq":
      return primitiveAt(cond.key, chain) === cond.value;
    case "answered":
      return primitiveAt(cond.key, chain) !== undefined;
    case "complete": {
      const res = resolveKey(cond.key, chain);
      if (!res) return false;
      return subtreeComplete(res, chain);
    }
    case "all":
      return cond.conditions.every((c) => evalCondition(c, chain, subtreeComplete));
    case "any":
      return cond.conditions.some((c) => evalCondition(c, chain, subtreeComplete));
    case "not":
      return !evalCondition(cond.condition, chain, subtreeComplete);
  }
}
