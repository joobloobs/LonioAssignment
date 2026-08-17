import { describe, expect, it } from "vitest";
import type { AnswersDoc, TariffModule } from "../src/index";
import { evaluate } from "../src/index";
import { testFlow } from "./flow.fixture";

const module_: TariffModule<AnswersDoc> = {
  cantonId: "XX",
  cantonLabel: "Test canton",
  engineVersion: "0.0.0",
  flow: testFlow,
  answerSchema: {
    safeParse: (input: unknown) =>
      typeof input === "object" && input !== null && !("bad" in input)
        ? { success: true, data: input as AnswersDoc }
        : { success: false, error: { issues: [{ path: ["bad"], message: "nope" }] } },
  },
  computeTariff: () => ({ kind: "code", code: "X0X" }),
};

describe("evaluate", () => {
  it("returns schemaInvalid with readable issues", () => {
    const r = evaluate(module_, { bad: true });
    expect(r).toEqual({ status: "schemaInvalid", issues: ["bad: nope"] });
  });

  it("returns stale before incomplete", () => {
    const r = evaluate(module_, { a: false, b: true });
    expect(r.status).toBe("stale");
    if (r.status === "stale") expect(r.staleKeys).toEqual(["b"]);
  });

  it("returns incomplete with the exact missing keys", () => {
    const r = evaluate(module_, { a: true });
    expect(r).toEqual({ status: "incomplete", missingKeys: ["b", "final"] });
  });

  it("computes the outcome only on complete documents", () => {
    const r = evaluate(module_, { a: true, b: false, final: true });
    expect(r).toEqual({ status: "complete", outcome: { kind: "code", code: "X0X" } });
  });
});
