import { beforeEach, describe, expect, it, vi } from "vitest";

// Route handlers use the shared singleton; point it at an in-memory database.
vi.mock("@/server/db", async () => {
  const actual = await vi.importActual<typeof import("../src/server/db")>("../src/server/db");
  const db = actual.createDb(":memory:");
  return { ...actual, getDb: () => db };
});

import { GET, POST } from "../src/app/api/employees/route";
import { getDb } from "@/server/db";
import { employees, tariffAssessments } from "@/server/db/schema";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://test/api/employees", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const basePerson = { firstName: "Ana", lastName: "Silva", canton: "ZH" };

const completeAnswers = {
  mainIncome: true,
  civilStatusMarriedOrRegisteredRelationship: true,
  recognizedReligiousAffiliation: true,
  partnerEmployed: true,
  withChildren: false,
  centerOfLife: { residenceInSwitzerland: true },
};

beforeEach(() => {
  getDb().delete(tariffAssessments).run();
  getDb().delete(employees).run();
});

describe("POST /api/employees", () => {
  it("creates a Swiss employee without questionnaire or assessment", async () => {
    const res = await post({ ...basePerson, nationality: "CH" });
    expect(res.status).toBe(201);
    const list = (await (await GET()).json()) as { subjectToSourceTax: boolean; assessment: unknown }[];
    expect(list).toHaveLength(1);
    expect(list[0]?.subjectToSourceTax).toBe(false);
    expect(list[0]?.assessment).toBeNull();
  });

  it("computes and persists the tariff for a complete non-Swiss submission", async () => {
    const res = await post({ ...basePerson, nationality: "PT", answers: completeAnswers });
    expect(res.status).toBe(201);
    const list = (await (await GET()).json()) as {
      assessment: { outcome: { kind: string; code?: string }; engineVersion: string } | null;
    }[];
    expect(list[0]?.assessment?.outcome).toEqual({ kind: "code", code: "C0Y" });
    expect(list[0]?.assessment?.engineVersion).toBe("zh-1.0.0");
  });

  it("ignores any client-supplied tariff result field", async () => {
    const res = await post({
      ...basePerson,
      nationality: "PT",
      answers: completeAnswers,
      result: { kind: "code", code: "A0N" },
    });
    // Unknown top-level keys are rejected outright — nothing to smuggle through.
    expect(res.status).toBe(400);
  });

  it("rejects incomplete questionnaires with the missing keys", async () => {
    const res = await post({
      ...basePerson,
      nationality: "PT",
      answers: { mainIncome: true, civilStatusMarriedOrRegisteredRelationship: true },
    });
    expect(res.status).toBe(422);
    const err = (await res.json()) as { error: string; keys: string[] };
    expect(err.error).toBe("incomplete");
    expect(err.keys).toContain("recognizedReligiousAffiliation");
  });

  it("rejects stale answers (answered but unreachable) instead of computing", async () => {
    const res = await post({
      ...basePerson,
      nationality: "PT",
      answers: {
        ...completeAnswers,
        civilStatusMarriedOrRegisteredRelationship: false,
      },
    });
    expect(res.status).toBe(422);
    const err = (await res.json()) as { error: string; keys: string[] };
    expect(err.error).toBe("stale");
    expect(err.keys).toContain("partnerEmployed");
  });

  it("rejects unknown answer fields via the canton schema", async () => {
    const res = await post({
      ...basePerson,
      nationality: "PT",
      answers: { ...completeAnswers, salary: 100000 },
    });
    expect(res.status).toBe(422);
    const err = (await res.json()) as { error: string };
    expect(err.error).toBe("schemaInvalid");
  });

  it("rejects unsupported cantons explicitly", async () => {
    const res = await post({ ...basePerson, canton: "BE", nationality: "PT", answers: completeAnswers });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: string }).error).toBe("unsupportedCanton");
  });

  it("rejects malformed profiles", async () => {
    const res = await post({ ...basePerson, nationality: "Portugal" });
    expect(res.status).toBe(400);
  });
});
