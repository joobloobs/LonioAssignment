import { describe, expect, it } from "vitest";
import { analyze, restrictToReachable } from "../src/index";
import { testFlow } from "./flow.fixture";

describe("analyze", () => {
  it("reports visible unanswered questions on an empty document", () => {
    const a = analyze(testFlow, {});
    // `final` is visible already: `complete(reps)` is vacuously true while reps
    // is invisible (matches the vendor's allChildQuestionnairesCompleted on an
    // empty list); guarding against that is the flow author's job, as ZH does.
    expect(a.missing).toEqual(["a", "final"]);
    expect(a.stale).toEqual([]);
  });

  it("walks visibility forward in flow order", () => {
    expect(analyze(testFlow, { a: true }).missing).toEqual(["b", "final"]);
    expect(analyze(testFlow, { a: true, b: true }).missing).toEqual(["mode", "final"]);
    expect(analyze(testFlow, { a: true, b: false }).missing).toEqual(["final"]);
  });

  it("recurses into groups and resolves lexical references to parent scopes", () => {
    const a = analyze(testFlow, { a: true, b: true, mode: "one", grp: { inner: true } });
    expect(a.missing).toEqual(["grp.innerDep", "final"]);
    // With a=false the same inner answer would not expose innerDep (a-ref is
    // lexical); final stays hidden until the incomplete item is finished.
    const b = analyze(testFlow, { a: false, reps: [{ x: true }] });
    expect(b.missing).toEqual(["reps[0].y"]);
  });

  it("requires minItems on a visible repeating group and completes via `complete`", () => {
    expect(analyze(testFlow, { a: false }).missing).toEqual(["reps"]);
    const done = analyze(testFlow, { a: false, reps: [{ x: false }], final: true });
    expect(done.missing).toEqual([]);
    expect(done.stale).toEqual([]);
  });

  it("flags answers to unreachable questions as stale, including whole subtrees", () => {
    const a = analyze(testFlow, { a: false, b: true });
    expect(a.stale).toEqual(["b"]);
    const b = analyze(testFlow, {
      a: true,
      b: true,
      mode: "two",
      grp: { inner: true, innerDep: false },
    });
    expect(b.stale).toEqual(["grp.inner", "grp.innerDep"]);
    const c = analyze(testFlow, { a: true, b: false, reps: [{ x: true, y: true }] });
    expect(c.stale).toEqual(["reps[0].x", "reps[0].y"]);
  });
});

describe("restrictToReachable", () => {
  it("prunes stale answers, cascading to a fixpoint", () => {
    // b is stale once a=false; grp's visibility read the stale mode answer, so
    // grp only becomes prunable on the second iteration.
    const doc = { a: false, b: true, mode: "one", grp: { inner: true }, reps: [{ x: false }] };
    expect(restrictToReachable(testFlow, doc)).toEqual({ a: false, reps: [{ x: false }] });
  });

  it("is the identity on clean documents", () => {
    const doc = { a: true, b: true, mode: "one", grp: { inner: false }, final: true };
    expect(restrictToReachable(testFlow, doc)).toEqual(doc);
  });
});
