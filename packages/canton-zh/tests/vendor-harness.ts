/**
 * Executes the *vendor's own* decision services (`_l`, `El`, `Zl`) extracted
 * from the captured Zurich bundle, offline and outside the app runtime, as a
 * differential-testing oracle (SPEC §8). Line ranges are pinned to the frozen
 * artifact `extraction_reference/main.formatted.js` — see EXTRACTION-NOTES.md.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ZhAnswers } from "../src/index";

const bundlePath = fileURLToPath(
  new URL("../../../extraction_reference/main.formatted.js", import.meta.url),
);

interface VendorRate {
  rate?: string;
  remark?: string;
}

interface VendorServices {
  getRate(answers: ZhAnswers): VendorRate;
}

let cached: VendorServices | undefined;

export function loadVendorServices(): VendorServices {
  if (cached) return cached;
  const lines = readFileSync(bundlePath, "utf8").split("\n");
  const slice = (from: number, to: number) => lines.slice(from - 1, to).join("\n");
  const rhs = (text: string) =>
    text.replace(/^\s*\w+\s*=\s*/, "").replace(/\),\s*$/, ")");

  const factory = new Function(
    "al",
    "ll",
    "gl",
    "ke",
    `
    const cl = ${rhs(slice(14305, 14363))};
    const _l = ${rhs(slice(14428, 14718))};
    const El = ${rhs(slice(14858, 15105))};
    const Zl = ${rhs(slice(15707, 15797))};
    return { Rate: _l, Child: El, CenterOfLife: Zl };
    `,
  ) as (
    al: (d: unknown, b: unknown) => void,
    ll: typeof Object.assign,
    gl: () => string,
    ke: (x: unknown) => unknown,
  ) => {
    Rate: new () => {
      getRate(response: Record<string, unknown>): VendorRate;
    };
    Child: new () => {
      getResult(response: Record<string, unknown>, married: boolean): unknown;
    };
    CenterOfLife: new () => {
      getResult(response: Record<string, unknown>): unknown;
    };
  };

  const extendsHelper = (d: unknown, b: unknown): void => {
    const derived = d as { prototype: object };
    const base = b as { prototype: object };
    Object.setPrototypeOf(derived, base);
    derived.prototype = Object.create(base.prototype);
    (derived.prototype as { constructor: unknown }).constructor = derived;
  };

  const { Rate, Child, CenterOfLife } = factory(
    extendsHelper,
    Object.assign,
    () => "fixture-id",
    (x) => x,
  );

  const rateSvc = new Rate();
  const childSvc = new Child();
  const colSvc = new CenterOfLife();

  cached = {
    getRate(answers: ZhAnswers): VendorRate {
      const married = answers.civilStatusMarriedOrRegisteredRelationship === true;
      const colResponse = { ...(answers.centerOfLife ?? {}) };
      const response: Record<string, unknown> = {
        childQuestionnaires: (answers.children ?? []).map((c, i) => ({
          id: `child-${i}`,
          response: { ...c },
          result: childSvc.getResult({ ...c }, married),
        })),
        centerOfLifeQuestionnaire: {
          id: "col",
          response: colResponse,
          result: colSvc.getResult(colResponse),
        },
      };
      for (const key of [
        "mainIncome",
        "civilStatusMarriedOrRegisteredRelationship",
        "recognizedReligiousAffiliation",
        "partnerEmployed",
        "withChildren",
      ] as const) {
        if (answers[key] !== undefined) response[key] = answers[key];
      }
      return rateSvc.getRate(response);
    },
  };
  return cached;
}
