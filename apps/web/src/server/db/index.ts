import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const DDL = `
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  nationality TEXT NOT NULL,
  canton TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tariff_assessments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE REFERENCES employees(id) ON DELETE CASCADE,
  canton TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  answers TEXT NOT NULL,
  tariff_code TEXT,
  special_ruling TEXT,
  remark TEXT,
  computed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((tariff_code IS NULL) <> (special_ruling IS NULL))
);
`;

export type Db = ReturnType<typeof createDb>;

export function createDb(file: string) {
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(DDL);
  return drizzle(sqlite, { schema });
}

let singleton: Db | undefined;

/** Zero-setup persistence: the SQLite file is created on first access. */
export function getDb(): Db {
  if (!singleton) {
    const dir = path.join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    singleton = createDb(path.join(dir, "app.sqlite"));
  }
  return singleton;
}
