import { describe, expect, it } from "vitest";
import type { AnswersDoc, TariffOutcome } from "@lonio-poc/engine-core";
import { enumerateComplete, evaluate } from "@lonio-poc/engine-core";
import { zhFlow, zhModule } from "../src/index";
import type { ZhAnswers } from "../src/index";
import { loadVendorServices } from "./vendor-harness";

function toVendorShape(outcome: TariffOutcome): { rate: string; remark?: string } {
  const rate = outcome.kind === "code" ? outcome.code : outcome.text;
  return outcome.remark !== undefined ? { rate, remark: outcome.remark } : { rate };
}

describe("differential testing against the vendor bundle", () => {
  const vendor = loadVendorServices();

  it("sanity: vendor services reproduce the vendor's own examples", () => {
    const r = vendor.getRate({
      mainIncome: true,
      civilStatusMarriedOrRegisteredRelationship: false,
      recognizedReligiousAffiliation: false,
      withChildren: true,
      children: [
        {
          group: "UNDERAGE",
          childInSameHousehold: true,
          sharedCustody: true,
          sameHousehold: true,
          mainFinancialContributor: true,
        },
        { group: "OTHER" },
      ],
      centerOfLife: { residenceInSwitzerland: true },
    });
    expect(r.rate).toBe("H1N");
  });

  it("agrees with our engine on the entire enumerated answer space", () => {
    const docs = enumerateComplete(zhFlow, { maxRepeat: 2 });
    expect(docs.length).toBeGreaterThan(5000);
    const disagreements: string[] = [];
    for (const doc of docs) {
      const ours = evaluate(zhModule, doc as AnswersDoc);
      if (ours.status !== "complete") {
        disagreements.push(`not complete (${ours.status}): ${JSON.stringify(doc)}`);
        continue;
      }
      const mine = toVendorShape(ours.outcome);
      const theirs = vendor.getRate(doc as ZhAnswers);
      if (mine.rate !== theirs.rate || mine.remark !== theirs.remark) {
        disagreements.push(
          `ours=${JSON.stringify(mine)} vendor=${JSON.stringify(theirs)} for ${JSON.stringify(doc)}`,
        );
      }
    }
    expect(disagreements.slice(0, 5)).toEqual([]);
    expect(disagreements).toHaveLength(0);
  });
});
