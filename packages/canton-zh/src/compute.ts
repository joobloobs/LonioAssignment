import type { TariffOutcome } from "@lonio-poc/engine-core";
import { DTA_REMARK, NO_LIABILITY_TEXT } from "./types";
import type { ZhAnswers, ZhCenterOfLifeAnswers, ZhChildAnswers } from "./types";

/**
 * Faithful port of the vendor services (`El`, `Zl`, `_l`) per SPEC.md §3–§5.
 * `evaluate` guarantees complete, stale-free input before this runs; a missing
 * field here is an engine bug, hence `req` throws instead of returning a state.
 */
function req<T>(v: T | undefined): T {
  if (v === undefined) throw new Error("computeTariff called on an incomplete document");
  return v;
}

export interface ChildResult {
  justified: boolean;
  counts: boolean;
}

/** SPEC §3.1, vendor El.getResultForMarriedPeople [main.formatted.js:14867]. */
function marriedChildResult(c: ZhChildAnswers): ChildResult {
  switch (req(c.group)) {
    case "UNDERAGE":
      if (req(c.childInSameHousehold)) {
        if (req(c.sharedCustody)) {
          if (req(c.sameHousehold)) return { justified: true, counts: true }; // M1
          if (req(c.alternatingCustody))
            return { justified: true, counts: req(c.mainFinancialContributor) }; // M2/M3
          return { justified: true, counts: false }; // M4
        }
        return { justified: true, counts: true }; // M5
      }
      if (req(c.sharedCustody)) {
        if (req(c.alternatingCustody))
          return { justified: true, counts: req(c.mainFinancialContributor) }; // M6/M7
        return { justified: true, counts: false }; // M8
      }
      return { justified: true, counts: false }; // M9
    case "IN_FIRST_APPRENTICESHIP":
      if (req(c.childInSameHousehold)) {
        if (req(c.sameHousehold)) return { justified: true, counts: true }; // M10
        return { justified: true, counts: req(c.financiallySupported) }; // M11/M12
      }
      return { justified: true, counts: req(c.financiallySupported) }; // M13/M14
    case "OTHER":
      return { justified: true, counts: false }; // M15
  }
}

/** SPEC §3.2, vendor El.getResultForUnmarriedPeople [14972]. */
function unmarriedChildResult(c: ZhChildAnswers): ChildResult {
  switch (req(c.group)) {
    case "UNDERAGE":
      if (req(c.childInSameHousehold)) {
        if (req(c.sharedCustody)) {
          if (req(c.sameHousehold))
            return req(c.mainFinancialContributor)
              ? { justified: true, counts: true } // U1
              : { justified: false, counts: false }; // U2
          if (req(c.alternatingCustody))
            return req(c.mainFinancialContributor)
              ? { justified: true, counts: true } // U3
              : { justified: false, counts: false }; // U4
          return { justified: true, counts: true }; // U5
        }
        return { justified: true, counts: true }; // U6
      }
      if (req(c.parentalCare)) {
        if (req(c.alternatingCustody))
          return req(c.mainFinancialContributor)
            ? { justified: true, counts: true } // U7
            : { justified: false, counts: false }; // U8
        return { justified: false, counts: false }; // U9
      }
      return { justified: false, counts: false }; // U10
    case "IN_FIRST_APPRENTICESHIP":
      if (req(c.childInSameHousehold)) {
        if (req(c.sameHousehold))
          return req(c.mainFinancialContributor)
            ? { justified: true, counts: true } // U11
            : { justified: false, counts: false }; // U12
        return req(c.financiallySupported)
          ? { justified: true, counts: true } // U13
          : { justified: false, counts: false }; // U14
      }
      // U15: counts for the digit but does NOT justify the single-parent tariff.
      return req(c.financiallySupported)
        ? { justified: false, counts: true } // U15
        : { justified: false, counts: false }; // U16
    case "OTHER":
      return { justified: false, counts: false }; // U17
  }
}

export function computeChildResult(c: ZhChildAnswers, married: boolean): ChildResult {
  return married ? marriedChildResult(c) : unmarriedChildResult(c);
}

export interface CenterOfLifeResult {
  boarderCrosser: boolean;
  override?: string;
  remark?: string;
}

/** SPEC §4, vendor Zl.getResult [15713]. */
export function computeCenterOfLife(col: ZhCenterOfLifeAnswers): CenterOfLifeResult {
  if (req(col.residenceInSwitzerland)) return { boarderCrosser: false };
  switch (req(col.countryOfResidence)) {
    case "GERMANY":
      if (req(col.dailyReturnToGermany)) return { boarderCrosser: req(col.gre1_gre2) };
      if (req(col.dailyReturnToCountryOfResidenceReasonable))
        return { boarderCrosser: !req(col.gre3) };
      return { boarderCrosser: false };
    case "LIECHTENSTEIN":
      if (req(col.dailyReturnToLiechtenstein))
        return { boarderCrosser: false, override: NO_LIABILITY_TEXT, remark: DTA_REMARK };
      if (req(col.moreThanFortyFiveNonReturnDays))
        return { boarderCrosser: false, remark: DTA_REMARK };
      return { boarderCrosser: false, override: NO_LIABILITY_TEXT, remark: DTA_REMARK };
    case "OTHER":
      return { boarderCrosser: false };
  }
}

/** SPEC §5, vendor rateMap [14567]. */
const CROSS_BORDER_REMAP = { A: "L", B: "M", C: "N", H: "P" } as const;

function outcome(code: string, col: CenterOfLifeResult): TariffOutcome {
  if (col.override !== undefined) {
    return col.remark !== undefined
      ? { kind: "noLiability", text: col.override, remark: col.remark }
      : { kind: "noLiability", text: col.override };
  }
  return col.remark !== undefined ? { kind: "code", code, remark: col.remark } : { kind: "code", code };
}

/** SPEC §5, vendor getRate/getMainIncomeRate/getReplacementIncomeRate [14576–14681]. */
export function computeTariff(a: ZhAnswers): TariffOutcome {
  const col = computeCenterOfLife(req(a.centerOfLife));

  if (!req(a.mainIncome)) {
    return outcome(col.boarderCrosser ? "Q" : "G", col);
  }

  const married = req(a.civilStatusMarriedOrRegisteredRelationship);
  const suffix = req(a.recognizedReligiousAffiliation) ? "Y" : "N";

  let letter: keyof typeof CROSS_BORDER_REMAP;
  let countingChildren = 0;
  if (req(a.withChildren)) {
    const results = (a.children ?? []).map((c) => computeChildResult(c, married));
    countingChildren = results.filter((r) => r.counts).length;
    letter = married
      ? req(a.partnerEmployed)
        ? "C"
        : "B"
      : results.some((r) => r.justified)
        ? "H"
        : "A";
  } else {
    letter = married ? (req(a.partnerEmployed) ? "C" : "B") : "A";
  }

  const group = col.boarderCrosser ? CROSS_BORDER_REMAP[letter] : letter;
  const digit = Math.min(countingChildren, 9);
  return outcome(`${group}${digit}${suffix}`, col);
}
