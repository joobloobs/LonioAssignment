import type { AnswersDoc, QuestionFlow, QuestionNode } from "./types";
import type { KeyResolution, Scope } from "./conditions";
import { evalCondition } from "./conditions";

export interface FlowAnalysis {
  /** Paths of visible leaf questions that are answered. */
  reachable: string[];
  /** Paths of visible questions still unanswered (a repeatingGroup path means "needs items"). */
  missing: string[];
  /** Paths of answered questions that are no longer reachable. */
  stale: string[];
}

export function isNodeVisible(node: QuestionNode, chain: readonly Scope[]): boolean {
  if (!node.visibleWhen) return true;
  return evalCondition(node.visibleWhen, chain, subtreeComplete);
}

function subtreeComplete(res: KeyResolution, chain: readonly Scope[]): boolean {
  const upChain = chain.slice(0, res.scopeIndex + 1);
  const node = res.node;
  if (!isNodeVisible(node, upChain)) return true;
  switch (node.kind) {
    case "boolean":
    case "enum":
      return typeof res.value === "boolean" || typeof res.value === "string";
    case "group": {
      const sub = (res.value ?? {}) as AnswersDoc;
      const a = analyzeInChain(node.flow, sub, upChain, "");
      return a.missing.length === 0 && a.stale.length === 0;
    }
    case "repeatingGroup": {
      const items = (res.value ?? []) as AnswersDoc[];
      if (items.length < node.minItems) return false;
      return items.every((item) => {
        const a = analyzeInChain(node.itemFlow, item, upChain, "");
        return a.missing.length === 0 && a.stale.length === 0;
      });
    }
  }
}

function collectAnsweredPaths(node: QuestionNode, value: AnswersDoc[string], path: string, out: string[]): void {
  switch (node.kind) {
    case "boolean":
    case "enum":
      if (typeof value === "boolean" || typeof value === "string") out.push(path);
      return;
    case "group": {
      if (value === undefined) return;
      const sub = value as AnswersDoc;
      for (const child of node.flow.nodes) {
        collectAnsweredPaths(child, sub[child.key], `${path}.${child.key}`, out);
      }
      return;
    }
    case "repeatingGroup": {
      if (value === undefined) return;
      const items = value as AnswersDoc[];
      items.forEach((item, i) => {
        for (const child of node.itemFlow.nodes) {
          collectAnsweredPaths(child, item[child.key], `${path}[${i}].${child.key}`, out);
        }
      });
      return;
    }
  }
}

function analyzeInChain(
  flow: QuestionFlow,
  doc: AnswersDoc,
  outerChain: readonly Scope[],
  prefix: string,
): FlowAnalysis {
  const out: FlowAnalysis = { reachable: [], missing: [], stale: [] };
  const chain: Scope[] = [...outerChain, { flow, doc }];
  for (const node of flow.nodes) {
    const path = `${prefix}${node.key}`;
    const value = doc[node.key];
    if (!isNodeVisible(node, chain)) {
      collectAnsweredPaths(node, value, path, out.stale);
      continue;
    }
    switch (node.kind) {
      case "boolean":
      case "enum":
        if (typeof value === "boolean" || typeof value === "string") out.reachable.push(path);
        else out.missing.push(path);
        break;
      case "group": {
        const sub = (value ?? {}) as AnswersDoc;
        const a = analyzeInChain(node.flow, sub, chain, `${path}.`);
        out.reachable.push(...a.reachable);
        out.missing.push(...a.missing);
        out.stale.push(...a.stale);
        break;
      }
      case "repeatingGroup": {
        const items = (value ?? []) as AnswersDoc[];
        if (items.length < node.minItems) out.missing.push(path);
        items.forEach((item, i) => {
          const a = analyzeInChain(node.itemFlow, item, chain, `${path}[${i}].`);
          out.reachable.push(...a.reachable);
          out.missing.push(...a.missing);
          out.stale.push(...a.stale);
        });
        break;
      }
    }
  }
  return out;
}

export function analyze(flow: QuestionFlow, doc: AnswersDoc): FlowAnalysis {
  return analyzeInChain(flow, doc, [], "");
}

export function analyzeWithChain(
  flow: QuestionFlow,
  doc: AnswersDoc,
  outerChain: readonly Scope[],
): FlowAnalysis {
  return analyzeInChain(flow, doc, outerChain, "");
}

function restrictOnce(flow: QuestionFlow, doc: AnswersDoc, outerChain: readonly Scope[]): AnswersDoc {
  const result: AnswersDoc = {};
  const chain: Scope[] = [...outerChain, { flow, doc }];
  for (const node of flow.nodes) {
    if (!isNodeVisible(node, chain)) continue;
    const value = doc[node.key];
    switch (node.kind) {
      case "boolean":
      case "enum":
        if (typeof value === "boolean" || typeof value === "string") result[node.key] = value;
        break;
      case "group":
        if (value !== undefined) {
          result[node.key] = restrictOnce(node.flow, value as AnswersDoc, chain);
        }
        break;
      case "repeatingGroup":
        if (value !== undefined) {
          result[node.key] = (value as AnswersDoc[]).map((item) =>
            restrictOnce(node.itemFlow, item, chain),
          );
        }
        break;
    }
  }
  return result;
}

/**
 * Drops every answer that is not currently reachable, iterating to a fixpoint
 * (removing one stale answer can make further answers unreachable). Used by the
 * form to derive the effective document; the server never restricts — it
 * rejects stale submissions instead.
 */
export function restrictToReachable(flow: QuestionFlow, doc: AnswersDoc): AnswersDoc {
  let current = doc;
  for (let i = 0; i < 25; i++) {
    const next = restrictOnce(flow, current, []);
    if (JSON.stringify(next) === JSON.stringify(current)) return next;
    current = next;
  }
  return current;
}

function clone<T extends AnswersDoc[string]>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => clone(v)) as T;
  if (value !== null && typeof value === "object") {
    const out: AnswersDoc = {};
    for (const [k, v] of Object.entries(value)) out[k] = clone(v);
    return out as T;
  }
  return value;
}

export interface PathSegment {
  key: string;
  index?: number;
}

export function parsePath(path: string): PathSegment[] {
  return path.split(".").map((raw) => {
    const m = /^([A-Za-z0-9_]+)(?:\[(\d+)\])?$/.exec(raw);
    if (!m || m[1] === undefined) throw new Error(`Invalid answer path: ${path}`);
    return m[2] === undefined ? { key: m[1] } : { key: m[1], index: Number(m[2]) };
  });
}

export function nodeAtPath(flow: QuestionFlow, segments: readonly PathSegment[]): QuestionNode {
  let currentFlow = flow;
  let node: QuestionNode | undefined;
  for (const seg of segments) {
    node = currentFlow.nodes.find((n) => n.key === seg.key);
    if (!node) throw new Error(`Path segment "${seg.key}" not declared in flow`);
    if (node.kind === "group") currentFlow = node.flow;
    else if (node.kind === "repeatingGroup") currentFlow = node.itemFlow;
  }
  if (!node) throw new Error("Empty answer path");
  return node;
}

export function chainAtPath(
  flow: QuestionFlow,
  doc: AnswersDoc,
  segments: readonly PathSegment[],
): Scope[] {
  const chain: Scope[] = [{ flow, doc }];
  let currentFlow = flow;
  let currentDoc = doc;
  for (const seg of segments) {
    const node = currentFlow.nodes.find((n) => n.key === seg.key);
    if (!node) throw new Error(`Path segment "${seg.key}" not declared in flow`);
    if (node.kind === "group") {
      currentFlow = node.flow;
      currentDoc = (currentDoc[seg.key] ?? {}) as AnswersDoc;
      chain.push({ flow: currentFlow, doc: currentDoc });
    } else if (node.kind === "repeatingGroup") {
      const items = (currentDoc[seg.key] ?? []) as AnswersDoc[];
      currentFlow = node.itemFlow;
      currentDoc = seg.index !== undefined ? (items[seg.index] ?? {}) : {};
      chain.push({ flow: currentFlow, doc: currentDoc });
    }
  }
  return chain;
}

export function setAtPath(
  doc: AnswersDoc,
  segments: readonly PathSegment[],
  value: AnswersDoc[string],
): AnswersDoc {
  const root = clone(doc) as AnswersDoc;
  let container: AnswersDoc = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!seg) throw new Error("Invalid path");
    let next = container[seg.key];
    if (seg.index !== undefined) {
      if (next === undefined) next = container[seg.key] = [];
      const items = next as AnswersDoc[];
      let item = items[seg.index];
      if (item === undefined) item = items[seg.index] = {};
      container = item;
    } else {
      if (next === undefined) next = container[seg.key] = {};
      container = next as AnswersDoc;
    }
  }
  const last = segments[segments.length - 1];
  if (!last) throw new Error("Empty answer path");
  if (last.index !== undefined) throw new Error("Cannot set an indexed path terminal");
  container[last.key] = clone(value);
  return root;
}
