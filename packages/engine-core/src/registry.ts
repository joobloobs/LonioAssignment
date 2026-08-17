import type { AnswersDoc, CantonId, TariffModule } from "./types";

export interface CantonRegistry {
  get(cantonId: string): TariffModule<AnswersDoc> | undefined;
  supported(): { id: CantonId; label: string }[];
}

export function createRegistry(modules: readonly TariffModule<AnswersDoc>[]): CantonRegistry {
  const byId = new Map(modules.map((m) => [m.cantonId, m]));
  if (byId.size !== modules.length) throw new Error("Duplicate canton id in registry");
  return {
    get: (cantonId) => byId.get(cantonId),
    supported: () => modules.map((m) => ({ id: m.cantonId, label: m.cantonLabel })),
  };
}
