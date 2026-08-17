import { getDb } from "@/server/db";
import { getEmployee } from "@/server/repositories/employees";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const employee = getEmployee(getDb(), id);
  if (!employee) return Response.json({ error: "notFound" }, { status: 404 });
  return Response.json(employee);
}
