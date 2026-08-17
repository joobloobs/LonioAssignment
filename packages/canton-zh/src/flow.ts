import type { AnswerPrimitive, Condition, QuestionFlow } from "@lonio-poc/engine-core";

const eq = (key: string, value: AnswerPrimitive): Condition => ({ type: "eq", key, value });
const answered = (key: string): Condition => ({ type: "answered", key });
const complete = (key: string): Condition => ({ type: "complete", key });
const all = (...conditions: Condition[]): Condition => ({ type: "all", conditions });
const any = (...conditions: Condition[]): Condition => ({ type: "any", conditions });

const married = eq("civilStatusMarriedOrRegisteredRelationship", true);
const notMarried = eq("civilStatusMarriedOrRegisteredRelationship", false);
const underage = eq("group", "UNDERAGE");
const apprenticeship = eq("group", "IN_FIRST_APPRENTICESHIP");
const inHH = eq("childInSameHousehold", true);
const notInHH = eq("childInSameHousehold", false);

/** SPEC §2.2 — per-child sub-questionnaire. `married` resolves lexically to the top level. */
const childFlow: QuestionFlow = {
  nodes: [
    {
      kind: "enum",
      key: "group",
      label: "Is the child a minor, or an adult in initial vocational training?",
      options: [
        { value: "UNDERAGE", label: "Minor", help: "The child is under 18" },
        {
          value: "IN_FIRST_APPRENTICESHIP",
          label: "Adult in initial vocational training",
          help: "The child is of age and in initial vocational training",
        },
        { value: "OTHER", label: "Neither", help: "None of the options apply" },
      ],
    },
    {
      kind: "boolean",
      key: "childInSameHousehold",
      label: "Does the child live in the same household?",
      visibleWhen: any(underage, apprenticeship),
    },
    {
      kind: "boolean",
      key: "parentalCare",
      label: "Do you have parental care (custody) of the child?",
      visibleWhen: all(underage, notMarried, notInHH),
    },
    {
      kind: "boolean",
      key: "sharedCustody",
      label: "Is custody shared with the other parent?",
      visibleWhen: any(all(underage, inHH), all(underage, married, notInHH)),
    },
    {
      kind: "boolean",
      key: "sameHousehold",
      label: "Do you share a household with the other parent?",
      visibleWhen: any(
        all(underage, inHH, eq("sharedCustody", true)),
        all(apprenticeship, inHH),
      ),
    },
    {
      kind: "boolean",
      key: "alternatingCustody",
      label: "Is there alternating care of the child?",
      visibleWhen: all(
        underage,
        any(
          all(notInHH, eq("parentalCare", true)),
          all(inHH, eq("sameHousehold", false)),
          all(married, notInHH, eq("sharedCustody", true)),
        ),
      ),
    },
    {
      kind: "boolean",
      key: "mainFinancialContributor",
      label: "Who contributes more financially to the child's maintenance?",
      trueLabel: "The taxable person (me)",
      falseLabel: "The other parent",
      visibleWhen: any(
        all(
          underage,
          any(
            all(notInHH, eq("alternatingCustody", true)),
            all(inHH, eq("sameHousehold", true), notMarried),
            all(inHH, eq("alternatingCustody", true)),
          ),
        ),
        all(apprenticeship, notMarried, eq("sameHousehold", true)),
      ),
    },
    {
      kind: "boolean",
      key: "financiallySupported",
      label: "Do you cover the majority (more than 50%) of the child's maintenance?",
      visibleWhen: all(
        apprenticeship,
        any(all(inHH, eq("sameHousehold", false)), notInHH),
      ),
    },
  ],
};

/** SPEC §2.3 — centre of life / cross-border block. Conditions are vendor-exact. */
const centerOfLifeFlow: QuestionFlow = {
  nodes: [
    {
      kind: "boolean",
      key: "residenceInSwitzerland",
      label: "Is your residence (centre of life) in Switzerland?",
    },
    {
      kind: "enum",
      key: "countryOfResidence",
      label: "Country of residence",
      options: [
        { value: "GERMANY", label: "Germany" },
        { value: "LIECHTENSTEIN", label: "Liechtenstein" },
        { value: "OTHER", label: "Other country" },
      ],
      visibleWhen: eq("residenceInSwitzerland", false),
    },
    {
      kind: "boolean",
      key: "dailyReturnToGermany",
      label: "Do you return to your residence in Germany daily?",
      visibleWhen: eq("countryOfResidence", "GERMANY"),
    },
    {
      kind: "boolean",
      key: "gre1_gre2",
      label: "Has a residence certificate been provided?",
      help: "Forms Gre-1 / Gre-2",
      visibleWhen: all(eq("countryOfResidence", "GERMANY"), eq("dailyReturnToGermany", true)),
    },
    {
      kind: "boolean",
      key: "dailyReturnToCountryOfResidenceReasonable",
      label: "Would daily return to your country of residence be reasonable?",
      visibleWhen: all(eq("countryOfResidence", "GERMANY"), eq("dailyReturnToGermany", false)),
    },
    {
      kind: "boolean",
      key: "gre3",
      label: "Has proof of more than 60 work-related non-return days per calendar year been provided?",
      help: "Form Gre-3",
      visibleWhen: all(
        eq("countryOfResidence", "GERMANY"),
        eq("dailyReturnToCountryOfResidenceReasonable", true),
      ),
    },
    {
      kind: "boolean",
      key: "dailyReturnToLiechtenstein",
      label: "Do you return to your residence in Liechtenstein daily?",
      visibleWhen: eq("countryOfResidence", "LIECHTENSTEIN"),
    },
    {
      kind: "boolean",
      key: "moreThanFortyFiveNonReturnDays",
      label: "More than 45 work-related non-return days per calendar year?",
      visibleWhen: eq("dailyReturnToLiechtenstein", false),
    },
  ],
};

/** SPEC §2.1 — top-level flow. */
export const zhFlow: QuestionFlow = {
  nodes: [
    {
      kind: "boolean",
      key: "mainIncome",
      label: "For which income should the source-tax tariff be determined?",
      trueLabel: "Employment income",
      falseLabel: "Replacement income",
    },
    {
      kind: "boolean",
      key: "civilStatusMarriedOrRegisteredRelationship",
      label: "Civil status",
      trueLabel: "Married or registered partnership",
      falseLabel: "Single, divorced, separated or widowed",
      visibleWhen: eq("mainIncome", true),
    },
    {
      kind: "boolean",
      key: "recognizedReligiousAffiliation",
      label: "Religious affiliation",
      trueLabel: "Roman Catholic, Christian Catholic or Protestant Reformed",
      falseLabel: "None or other",
      visibleWhen: answered("civilStatusMarriedOrRegisteredRelationship"),
    },
    {
      kind: "boolean",
      key: "partnerEmployed",
      label: "Is your spouse or registered partner gainfully employed?",
      visibleWhen: all(married, answered("recognizedReligiousAffiliation")),
    },
    {
      kind: "boolean",
      key: "withChildren",
      label: "Do you (or your spouse or partner) have biological or adopted children?",
      visibleWhen: any(
        all(married, answered("partnerEmployed")),
        all(notMarried, answered("recognizedReligiousAffiliation")),
      ),
    },
    {
      kind: "repeatingGroup",
      key: "children",
      label: "Children",
      itemLabel: "Child",
      minItems: 1,
      maxItems: 15,
      itemFlow: childFlow,
      visibleWhen: eq("withChildren", true),
    },
    {
      kind: "group",
      key: "centerOfLife",
      label: "Residence and centre of life",
      flow: centerOfLifeFlow,
      visibleWhen: any(
        all(eq("mainIncome", true), answered("withChildren"), complete("children")),
        eq("mainIncome", false),
      ),
    },
  ],
};
