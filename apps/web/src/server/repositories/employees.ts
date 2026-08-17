import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { AnswersDoc, TariffOutcome } from "@lonio-poc/engine-core";
import type { Db } from "../db";
import { employees, tariffAssessments } from "../db/schema";
import type { AssessmentDto, EmployeeDetail, EmployeeListItem } from "@/contracts";

export interface NewEmployee {
  firstName: string;
  lastName: string;
  nationality: string;
  canton: string;
}

export interface NewAssessment {
  canton: string;
  engineVersion: string;
  answers: AnswersDoc;
  outcome: TariffOutcome;
}

export function createEmployee(db: Db, employee: NewEmployee, assessment?: NewAssessment): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.transaction((tx) => {
    tx.insert(employees)
      .values({ id, ...employee, createdAt: now, updatedAt: now })
      .run();
    if (assessment) {
      tx.insert(tariffAssessments)
        .values({
          id: randomUUID(),
          employeeId: id,
          canton: assessment.canton,
          engineVersion: assessment.engineVersion,
          answers: assessment.answers,
          tariffCode: assessment.outcome.kind === "code" ? assessment.outcome.code : null,
          specialRuling: assessment.outcome.kind === "noLiability" ? assessment.outcome.text : null,
          remark: assessment.outcome.remark ?? null,
          computedAt: now,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });
  return id;
}

type AssessmentRow = typeof tariffAssessments.$inferSelect;
type EmployeeRow = typeof employees.$inferSelect;

function toOutcome(row: AssessmentRow): TariffOutcome {
  const remark = row.remark ?? undefined;
  if (row.tariffCode !== null) {
    return remark !== undefined
      ? { kind: "code", code: row.tariffCode, remark }
      : { kind: "code", code: row.tariffCode };
  }
  if (row.specialRuling !== null) {
    return remark !== undefined
      ? { kind: "noLiability", text: row.specialRuling, remark }
      : { kind: "noLiability", text: row.specialRuling };
  }
  throw new Error(`Assessment ${row.id} violates the outcome invariant`);
}

function toAssessmentDto(row: AssessmentRow): AssessmentDto {
  return {
    canton: row.canton,
    engineVersion: row.engineVersion,
    outcome: toOutcome(row),
    computedAt: row.computedAt,
  };
}

function toListItem(row: { employee: EmployeeRow; assessment: AssessmentRow | null }): EmployeeListItem {
  return {
    id: row.employee.id,
    firstName: row.employee.firstName,
    lastName: row.employee.lastName,
    nationality: row.employee.nationality,
    canton: row.employee.canton,
    subjectToSourceTax: row.employee.nationality !== "CH",
    assessment: row.assessment ? toAssessmentDto(row.assessment) : null,
    createdAt: row.employee.createdAt,
  };
}

export function listEmployees(db: Db): EmployeeListItem[] {
  const rows = db
    .select({ employee: employees, assessment: tariffAssessments })
    .from(employees)
    .leftJoin(tariffAssessments, eq(tariffAssessments.employeeId, employees.id))
    .orderBy(desc(employees.createdAt))
    .all();
  return rows.map(toListItem);
}

export function getEmployee(db: Db, id: string): EmployeeDetail | undefined {
  const row = db
    .select({ employee: employees, assessment: tariffAssessments })
    .from(employees)
    .leftJoin(tariffAssessments, eq(tariffAssessments.employeeId, employees.id))
    .where(eq(employees.id, id))
    .get();
  if (!row) return undefined;
  return { ...toListItem(row), answers: row.assessment?.answers ?? null };
}
