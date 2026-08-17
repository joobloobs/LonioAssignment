import type { TariffOutcome } from "@lonio-poc/engine-core";

/**
 * Presentation of outcomes. Canonical values stay in the vendor's German
 * (that is what gets stored and compared); the UI shows a translation.
 */
const TRANSLATIONS: Record<string, string> = {
  "Grundsätzlich keine Quellensteuerpflicht": "No source-tax liability in principle",
  "Unter Vorbehalt des Doppelbesteuerungsabkommens":
    "Subject to the applicable double-taxation agreement",
};

export function translate(text: string): string {
  return TRANSLATIONS[text] ?? text;
}

export interface OutcomeView {
  kind: "code" | "noLiability";
  main: string;
  remark?: string;
}

export function describeOutcome(outcome: TariffOutcome): OutcomeView {
  const remark = outcome.remark !== undefined ? translate(outcome.remark) : undefined;
  const base =
    outcome.kind === "code"
      ? { kind: "code" as const, main: outcome.code }
      : { kind: "noLiability" as const, main: translate(outcome.text) };
  return remark !== undefined ? { ...base, remark } : base;
}
