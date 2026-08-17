import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { analyze, enumerateComplete, restrictToReachable } from "@lonio-poc/engine-core";
import type { AnswersDoc } from "@lonio-poc/engine-core";
import { zhFlow } from "../src/index";
import type { ZhAnswers } from "../src/index";

/**
 * The form renders `restrictToReachable(flow, answers)` directly.
 * `isNodeVisible` only checks a node's own condition, so an *unrestricted*
 * document can render orphans: a question whose condition still passes because
 * the answer it names is itself no longer reachable. These tests pin the
 * property the renderer depends on — after restriction, no orphans remain.
 */

const corpus = enumerateComplete(zhFlow, { maxRepeat: 2 });

describe("restricted documents have no orphaned questions", () => {
  it("flipping residence to Switzerland drops the whole Germany subtree", () => {
    const answered: AnswersDoc = {
      mainIncome: true,
      civilStatusMarriedOrRegisteredRelationship: false,
      recognizedReligiousAffiliation: false,
      withChildren: false,
      centerOfLife: {
        residenceInSwitzerland: false,
        countryOfResidence: "GERMANY",
        dailyReturnToGermany: true,
        gre1_gre2: true,
      },
    };
    // Sanity: as answered, everything above is reachable.
    expect(analyze(zhFlow, answered).stale).toEqual([]);

    const flipped: AnswersDoc = {
      ...answered,
      centerOfLife: { ...(answered.centerOfLife as AnswersDoc), residenceInSwitzerland: true },
    };
    // One restriction pass would only drop `countryOfResidence`, leaving
    // `dailyReturnToGermany` / `gre1_gre2` on screen. The fixpoint drops all three.
    expect(restrictToReachable(zhFlow, flipped)).toEqual({
      ...answered,
      centerOfLife: { residenceInSwitzerland: true },
    });
  });

  const flips: ((a: ZhAnswers) => AnswersDoc | undefined)[] = [
    (a) => ({ ...a, mainIncome: !a.mainIncome }),
    (a) =>
      a.civilStatusMarriedOrRegisteredRelationship === undefined
        ? undefined
        : { ...a, civilStatusMarriedOrRegisteredRelationship: !a.civilStatusMarriedOrRegisteredRelationship },
    (a) => (a.withChildren === undefined ? undefined : { ...a, withChildren: !a.withChildren }),
    (a) =>
      a.centerOfLife === undefined
        ? undefined
        : {
            ...a,
            centerOfLife: {
              ...a.centerOfLife,
              residenceInSwitzerland: !a.centerOfLife.residenceInSwitzerland,
            },
          },
    (a) =>
      a.centerOfLife?.countryOfResidence === undefined
        ? undefined
        : { ...a, centerOfLife: { ...a.centerOfLife, countryOfResidence: "LIECHTENSTEIN" as const } },
    (a) => {
      const child = a.children?.[0];
      if (!child) return undefined;
      return { ...a, children: [{ ...child, group: "OTHER" as const }, ...a.children!.slice(1)] };
    },
    (a) => {
      const child = a.children?.[0];
      if (child?.childInSameHousehold === undefined) return undefined;
      return {
        ...a,
        children: [
          { ...child, childInSameHousehold: !child.childInSameHousehold },
          ...a.children!.slice(1),
        ],
      };
    },
  ];

  it("restriction of any single-answer edit is orphan-free and a fixpoint", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: corpus.length - 1 }),
        fc.nat({ max: flips.length - 1 }),
        (docIdx, flipIdx) => {
          const doc = corpus[docIdx] as ZhAnswers;
          const edited = flips[flipIdx]?.(doc);
          if (edited === undefined) return true;

          const restricted = restrictToReachable(zhFlow, edited);
          // No answer survives that the flow no longer reaches...
          expect(analyze(zhFlow, restricted).stale).toEqual([]);
          // ...and restricting again changes nothing (the loop converged).
          expect(restrictToReachable(zhFlow, restricted)).toEqual(restricted);
          return true;
        },
      ),
      { numRuns: 400 },
    );
  });
});
