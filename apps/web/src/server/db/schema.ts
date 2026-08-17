import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { AnswersDoc } from "@lonio-poc/engine-core";

export const employees = sqliteTable("employees", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  nationality: text("nationality").notNull(),
  canton: text("canton").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/**
 * Answers are the immutable source of truth (JSON document, canton-shaped);
 * tariff_code/special_ruling/remark are derived columns consistent with
 * `answers` under `engine_version`. Exactly one of tariff_code/special_ruling
 * is set (DB CHECK). See docs/adr-answers-as-versioned-document.md.
 */
export const tariffAssessments = sqliteTable("tariff_assessments", {
  id: text("id").primaryKey(),
  employeeId: text("employee_id")
    .notNull()
    .unique()
    .references(() => employees.id, { onDelete: "cascade" }),
  canton: text("canton").notNull(),
  engineVersion: text("engine_version").notNull(),
  answers: text("answers", { mode: "json" }).$type<AnswersDoc>().notNull(),
  tariffCode: text("tariff_code"),
  specialRuling: text("special_ruling"),
  remark: text("remark"),
  computedAt: text("computed_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
