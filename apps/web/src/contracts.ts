import { z } from "zod";
import type { TariffOutcome } from "@lonio-poc/engine-core";

/** Request/response contracts shared by the client fetch layer and the API. */

export const createEmployeeRequestSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  nationality: z.string().regex(/^[A-Z]{2}$/, "ISO 3166-1 alpha-2 code expected"),
  canton: z.string().regex(/^[A-Z]{2}$/, "canton code expected"),
  answers: z.unknown().optional(),
});

export type CreateEmployeeRequest = z.infer<typeof createEmployeeRequestSchema>;

export interface CreateEmployeeSuccess {
  id: string;
}

export type CreateEmployeeError =
  | { error: "badRequest"; detail: string[] }
  | { error: "unsupportedCanton"; canton: string }
  | { error: "schemaInvalid"; keys: string[] }
  | { error: "stale"; keys: string[] }
  | { error: "incomplete"; keys: string[] };

export interface AssessmentDto {
  canton: string;
  engineVersion: string;
  outcome: TariffOutcome;
  computedAt: string;
}

export interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  canton: string;
  subjectToSourceTax: boolean;
  assessment: AssessmentDto | null;
  createdAt: string;
}

export interface EmployeeDetail extends EmployeeListItem {
  answers: unknown;
}
