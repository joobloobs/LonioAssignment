import type { TariffModule } from "@lonio-poc/engine-core";
import { zhFlow } from "./flow";
import { zhAnswerSchema } from "./schema";
import { computeTariff } from "./compute";
import type { ZhAnswers } from "./types";

export const ZH_ENGINE_VERSION = "zh-1.0.0";

export const zhModule: TariffModule<ZhAnswers> = {
  cantonId: "ZH",
  cantonLabel: "Zurich",
  engineVersion: ZH_ENGINE_VERSION,
  flow: zhFlow,
  answerSchema: zhAnswerSchema,
  computeTariff,
};

export { zhFlow } from "./flow";
export { zhAnswerSchema } from "./schema";
export { computeTariff, computeChildResult, computeCenterOfLife } from "./compute";
export type { ChildResult, CenterOfLifeResult } from "./compute";
export {
  CHILD_GROUPS,
  RESIDENCE_COUNTRIES,
  NO_LIABILITY_TEXT,
  DTA_REMARK,
} from "./types";
export type {
  ChildGroup,
  ResidenceCountry,
  ZhAnswers,
  ZhChildAnswers,
  ZhCenterOfLifeAnswers,
} from "./types";
