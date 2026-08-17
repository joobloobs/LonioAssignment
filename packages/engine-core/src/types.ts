export type AnswerPrimitive = boolean | string;

export interface AnswersDoc {
  [key: string]: AnswerPrimitive | AnswersDoc | AnswersDoc[] | undefined;
}

export type Condition =
  | { type: "eq"; key: string; value: AnswerPrimitive }
  | { type: "answered"; key: string }
  | { type: "complete"; key: string }
  | { type: "all"; conditions: readonly Condition[] }
  | { type: "any"; conditions: readonly Condition[] }
  | { type: "not"; condition: Condition };

export interface EnumOption {
  value: string;
  label: string;
  help?: string;
}

interface QuestionNodeBase {
  key: string;
  label: string;
  help?: string;
  visibleWhen?: Condition;
}

export interface BooleanQuestion extends QuestionNodeBase {
  kind: "boolean";
  trueLabel?: string;
  falseLabel?: string;
}

export interface EnumQuestion extends QuestionNodeBase {
  kind: "enum";
  options: readonly EnumOption[];
}

export interface GroupQuestion extends QuestionNodeBase {
  kind: "group";
  flow: QuestionFlow;
}

export interface RepeatingGroupQuestion extends QuestionNodeBase {
  kind: "repeatingGroup";
  itemLabel: string;
  itemFlow: QuestionFlow;
  minItems: number;
  maxItems: number;
}

export type QuestionNode =
  | BooleanQuestion
  | EnumQuestion
  | GroupQuestion
  | RepeatingGroupQuestion;

export interface QuestionFlow {
  nodes: readonly QuestionNode[];
}

export type TariffOutcome =
  | { kind: "code"; code: string; remark?: string }
  | { kind: "noLiability"; text: string; remark?: string };

export type EvaluationResult =
  | { status: "schemaInvalid"; issues: readonly string[] }
  | { status: "stale"; staleKeys: readonly string[] }
  | { status: "incomplete"; missingKeys: readonly string[] }
  | { status: "complete"; outcome: TariffOutcome };

export type CantonId = string;

/**
 * Minimal structural validation contract, satisfied by any zod schema. Keeping
 * this structural (instead of depending on zod types) keeps engine-core
 * dependency-free and makes TariffModule<Specific> assignable to
 * TariffModule<AnswersDoc> for the registry.
 */
export interface SchemaIssue {
  path: PropertyKey[];
  message: string;
}

export interface AnswerSchema<A> {
  safeParse(
    input: unknown,
  ): { success: true; data: A } | { success: false; error: { issues: SchemaIssue[] } };
}

export interface TariffModule<A extends AnswersDoc = AnswersDoc> {
  cantonId: CantonId;
  cantonLabel: string;
  engineVersion: string;
  flow: QuestionFlow;
  answerSchema: AnswerSchema<A>;
  computeTariff(answers: A): TariffOutcome;
}
