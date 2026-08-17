import { describe, expect, it } from "vitest";
import { analyze, enumerateComplete } from "@lonio-poc/engine-core";
import type { AnswersDoc } from "@lonio-poc/engine-core";
import { computeTariff, zhFlow } from "../src/index";
import type { ZhAnswers } from "../src/index";
import {
  centerOfLifeObjectSchema,
  childObjectSchema,
  zhAnswerObjectSchema,
} from "../src/schema";

/** Records every primitive answer field the compute function actually reads. */
function recordingProxy<T extends object>(doc: T, prefix: string, recorded: Set<string>): T {
  return new Proxy(doc, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop !== "string") return value;
      if (Array.isArray(value)) {
        return value.map((item, i) =>
          recordingProxy(item as object, `${prefix}${prop}[${i}].`, recorded),
        );
      }
      if (value !== null && typeof value === "object") {
        return recordingProxy(value as object, `${prefix}${prop}.`, recorded);
      }
      if (typeof value === "boolean" || typeof value === "string") {
        recorded.add(`${prefix}${prop}`);
      }
      return value;
    },
  });
}

describe("flow / compute / schema consistency (SPEC §6)", () => {
  it("compute never reads a field the flow does not make reachable", () => {
    const docs = enumerateComplete(zhFlow, { maxRepeat: 2 });
    for (const doc of docs) {
      const recorded = new Set<string>();
      computeTariff(recordingProxy(doc as ZhAnswers, "", recorded));
      const reachable = new Set(analyze(zhFlow, doc as AnswersDoc).reachable);
      for (const path of recorded) {
        expect(reachable.has(path), `compute read unreachable "${path}"`).toBe(true);
      }
    }
  });

  it("schema keys and flow keys are identical at every level", () => {
    const flowKeys = (nodes: readonly { key: string }[]) => [...nodes.map((n) => n.key)].sort();
    const top = zhFlow.nodes;
    const children = top.find((n) => n.key === "children");
    const col = top.find((n) => n.key === "centerOfLife");
    expect(Object.keys(zhAnswerObjectSchema.shape).sort()).toEqual(flowKeys(top));
    expect(Object.keys(childObjectSchema.shape).sort()).toEqual(
      flowKeys(children && children.kind === "repeatingGroup" ? children.itemFlow.nodes : []),
    );
    expect(Object.keys(centerOfLifeObjectSchema.shape).sort()).toEqual(
      flowKeys(col && col.kind === "group" ? col.flow.nodes : []),
    );
  });
});
