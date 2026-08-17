import { z } from "zod";
import { CHILD_GROUPS, RESIDENCE_COUNTRIES } from "./types";
import type { ZhAnswers } from "./types";

export const childObjectSchema = z.strictObject({
  group: z.enum(CHILD_GROUPS).optional(),
  childInSameHousehold: z.boolean().optional(),
  parentalCare: z.boolean().optional(),
  sharedCustody: z.boolean().optional(),
  sameHousehold: z.boolean().optional(),
  alternatingCustody: z.boolean().optional(),
  mainFinancialContributor: z.boolean().optional(),
  financiallySupported: z.boolean().optional(),
});

export const centerOfLifeObjectSchema = z.strictObject({
  residenceInSwitzerland: z.boolean().optional(),
  countryOfResidence: z.enum(RESIDENCE_COUNTRIES).optional(),
  dailyReturnToGermany: z.boolean().optional(),
  gre1_gre2: z.boolean().optional(),
  dailyReturnToCountryOfResidenceReasonable: z.boolean().optional(),
  gre3: z.boolean().optional(),
  dailyReturnToLiechtenstein: z.boolean().optional(),
  moreThanFortyFiveNonReturnDays: z.boolean().optional(),
});

/**
 * Validates the *shape* of a (possibly partial) answer document. Completeness
 * and reachability are the engine's concern, not the schema's — every field is
 * optional here, unknown keys are rejected.
 */
export const zhAnswerObjectSchema = z.strictObject({
  mainIncome: z.boolean().optional(),
  civilStatusMarriedOrRegisteredRelationship: z.boolean().optional(),
  recognizedReligiousAffiliation: z.boolean().optional(),
  partnerEmployed: z.boolean().optional(),
  withChildren: z.boolean().optional(),
  children: z.array(childObjectSchema).max(15).optional(),
  centerOfLife: centerOfLifeObjectSchema.optional(),
});

export const zhAnswerSchema: z.ZodType<ZhAnswers> = zhAnswerObjectSchema;
