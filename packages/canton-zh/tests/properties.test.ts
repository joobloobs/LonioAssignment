import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { enumerateComplete, evaluate } from "@lonio-poc/engine-core";
import type { AnswersDoc } from "@lonio-poc/engine-core";
import { computeCenterOfLife, zhFlow, zhModule } from "../src/index";
import type { ZhAnswers, ZhCenterOfLifeAnswers } from "../src/index";

const corpus = enumerateComplete(zhFlow, { maxRepeat: 2 });

function outcomeOf(doc: AnswersDoc) {
  const r = evaluate(zhModule, doc);
  if (r.status !== "complete") throw new Error(`corpus doc not complete: ${r.status}`);
  return r.outcome;
}

describe("invariants over the full corpus", () => {
  it("every outcome is a well-formed code, a bare G/Q, or the LI no-liability ruling", () => {
    for (const doc of corpus) {
      const o = outcomeOf(doc);
      if (o.kind === "noLiability") {
        expect(o.text).toBe("Grundsätzlich keine Quellensteuerpflicht");
      } else if ((doc as ZhAnswers).mainIncome === false) {
        expect(o.code).toMatch(/^[GQ]$/);
      } else {
        expect(o.code).toMatch(/^[ABCHLMNP][0-9][YN]$/);
      }
    }
  });

  it("the cross-border remap decides the letter alphabet (SPEC §5)", () => {
    for (const doc of corpus) {
      const a = doc as ZhAnswers;
      const o = outcomeOf(doc);
      if (o.kind !== "code") continue;
      const crossBorder = computeCenterOfLife(a.centerOfLife as ZhCenterOfLifeAnswers).boarderCrosser;
      const letter = o.code[0] as string;
      if (a.mainIncome === false) {
        expect(letter).toBe(crossBorder ? "Q" : "G");
      } else {
        expect(crossBorder ? "LMNP" : "ABCH").toContain(letter);
      }
    }
  });

  it("replacement-income outcomes never depend on civil status, religion or children", () => {
    for (const doc of corpus) {
      const a = doc as ZhAnswers;
      if (a.mainIncome !== false) continue;
      expect(a.civilStatusMarriedOrRegisteredRelationship).toBeUndefined();
      expect(a.recognizedReligiousAffiliation).toBeUndefined();
      expect(a.children).toBeUndefined();
    }
  });
});

describe("stale answers can never produce a result", () => {
  const injections: ((a: ZhAnswers) => ZhAnswers | undefined)[] = [
    (a) =>
      a.mainIncome === false
        ? { ...a, civilStatusMarriedOrRegisteredRelationship: true }
        : undefined,
    (a) =>
      a.mainIncome === true && a.civilStatusMarriedOrRegisteredRelationship === false
        ? { ...a, partnerEmployed: true }
        : undefined,
    (a) => {
      if (a.civilStatusMarriedOrRegisteredRelationship !== true) return undefined;
      const child = a.children?.[0];
      if (!child) return undefined;
      const children = [{ ...child, parentalCare: true }, ...(a.children?.slice(1) ?? [])];
      return { ...a, children };
    },
    (a) =>
      a.centerOfLife?.residenceInSwitzerland === true
        ? { ...a, centerOfLife: { ...a.centerOfLife, countryOfResidence: "GERMANY" as const } }
        : undefined,
  ];

  it("injecting an answer to any unreachable question yields status=stale", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: corpus.length - 1 }),
        fc.nat({ max: injections.length - 1 }),
        (docIdx, injIdx) => {
          const doc = corpus[docIdx] as ZhAnswers;
          const inject = injections[injIdx];
          if (!inject) return true;
          const poisoned = inject(doc);
          if (poisoned === undefined) return true;
          const r = evaluate(zhModule, poisoned);
          expect(r.status).toBe("stale");
          return true;
        },
      ),
      { numRuns: 300 },
    );
  });
});
