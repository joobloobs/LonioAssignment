import type { AnswersDoc, EvaluationResult, TariffModule } from "./types";
import { analyze } from "./analyze";

/**
 * The single entry point both the form (live) and the server (authoritative)
 * use: schema parse → stale check → completeness → compute.
 */
export function evaluate<A extends AnswersDoc>(
  module: TariffModule<A>,
  raw: unknown,
): EvaluationResult {
  const parsed = module.answerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "schemaInvalid",
      issues: parsed.error.issues.map((i) => `${i.path.map(String).join(".")}: ${i.message}`),
    };
  }
  const a = analyze(module.flow, parsed.data);
  if (a.stale.length > 0) return { status: "stale", staleKeys: a.stale };
  if (a.missing.length > 0) return { status: "incomplete", missingKeys: a.missing };
  return { status: "complete", outcome: module.computeTariff(parsed.data) };
}
