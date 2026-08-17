export const CHILD_GROUPS = ["UNDERAGE", "IN_FIRST_APPRENTICESHIP", "OTHER"] as const;
export type ChildGroup = (typeof CHILD_GROUPS)[number];

export const RESIDENCE_COUNTRIES = ["GERMANY", "LIECHTENSTEIN", "OTHER"] as const;
export type ResidenceCountry = (typeof RESIDENCE_COUNTRIES)[number];

export type ZhChildAnswers = {
  group?: ChildGroup | undefined;
  childInSameHousehold?: boolean | undefined;
  parentalCare?: boolean | undefined;
  sharedCustody?: boolean | undefined;
  sameHousehold?: boolean | undefined;
  alternatingCustody?: boolean | undefined;
  mainFinancialContributor?: boolean | undefined;
  financiallySupported?: boolean | undefined;
};

export type ZhCenterOfLifeAnswers = {
  residenceInSwitzerland?: boolean | undefined;
  countryOfResidence?: ResidenceCountry | undefined;
  dailyReturnToGermany?: boolean | undefined;
  gre1_gre2?: boolean | undefined;
  dailyReturnToCountryOfResidenceReasonable?: boolean | undefined;
  gre3?: boolean | undefined;
  dailyReturnToLiechtenstein?: boolean | undefined;
  moreThanFortyFiveNonReturnDays?: boolean | undefined;
};

export type ZhAnswers = {
  mainIncome?: boolean | undefined;
  civilStatusMarriedOrRegisteredRelationship?: boolean | undefined;
  recognizedReligiousAffiliation?: boolean | undefined;
  partnerEmployed?: boolean | undefined;
  withChildren?: boolean | undefined;
  children?: ZhChildAnswers[] | undefined;
  centerOfLife?: ZhCenterOfLifeAnswers | undefined;
};

/** Canonical vendor strings (SPEC §4) — stored verbatim, translated only in the UI. */
export const NO_LIABILITY_TEXT = "Grundsätzlich keine Quellensteuerpflicht";
export const DTA_REMARK = "Unter Vorbehalt des Doppelbesteuerungsabkommens";
