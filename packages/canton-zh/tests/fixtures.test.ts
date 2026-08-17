import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { TariffOutcome } from "@lonio-poc/engine-core";
import { evaluate } from "@lonio-poc/engine-core";
import { zhModule } from "../src/index";

interface Fixture {
  name: string;
  answers: unknown;
  expected: TariffOutcome;
}

function load(file: string): Fixture[] {
  const url = new URL(`../fixtures/${file}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as Fixture[];
}

describe.each([
  ["vendor-examples.json", load("vendor-examples.json")],
  ["curated.json", load("curated.json")],
])("golden fixtures: %s", (_file, fixtures) => {
  it.each(fixtures.map((f) => [f.name, f] as const))("%s", (_name, f) => {
    const r = evaluate(zhModule, f.answers);
    expect(r.status).toBe("complete");
    if (r.status === "complete") expect(r.outcome).toEqual(f.expected);
  });
});
