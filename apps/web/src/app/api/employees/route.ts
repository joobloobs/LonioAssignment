import { evaluate } from "@lonio-poc/engine-core";
import { cantonRegistry, SWISS_NATIONALITY } from "@/cantons";
import { createEmployeeRequestSchema } from "@/contracts";
import { getDb } from "@/server/db";
import { createEmployee, listEmployees } from "@/server/repositories/employees";

export function GET(): Response {
  return Response.json(listEmployees(getDb()));
}

/**
 * The authoritative path: the server never accepts a client-computed tariff —
 * it re-validates and recomputes from the raw answers (see security doc).
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "badRequest", detail: ["invalid JSON body"] }, { status: 400 });
  }

  const parsed = createEmployeeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "badRequest",
        detail: parsed.error.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`),
      },
      { status: 400 },
    );
  }
  const req = parsed.data;
  const profile = {
    firstName: req.firstName,
    lastName: req.lastName,
    nationality: req.nationality,
    canton: req.canton,
  };

  if (req.nationality === SWISS_NATIONALITY) {
    const id = createEmployee(getDb(), profile);
    return Response.json({ id }, { status: 201 });
  }

  const module_ = cantonRegistry.get(req.canton);
  if (!module_) {
    return Response.json({ error: "unsupportedCanton", canton: req.canton }, { status: 422 });
  }

  const answers = module_.answerSchema.safeParse(req.answers ?? {});
  if (!answers.success) {
    return Response.json(
      {
        error: "schemaInvalid",
        keys: answers.error.issues.map((i) => i.path.map(String).join(".")),
      },
      { status: 422 },
    );
  }

  const result = evaluate(module_, answers.data);
  switch (result.status) {
    case "schemaInvalid":
      return Response.json({ error: "schemaInvalid", keys: result.issues }, { status: 422 });
    case "stale":
      return Response.json({ error: "stale", keys: result.staleKeys }, { status: 422 });
    case "incomplete":
      return Response.json({ error: "incomplete", keys: result.missingKeys }, { status: 422 });
    case "complete": {
      const id = createEmployee(getDb(), profile, {
        canton: module_.cantonId,
        engineVersion: module_.engineVersion,
        answers: answers.data,
        outcome: result.outcome,
      });
      return Response.json({ id }, { status: 201 });
    }
  }
}
