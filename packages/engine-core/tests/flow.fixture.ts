import type { QuestionFlow } from "../src/index";

/**
 * Synthetic flow used across engine tests (deliberately not a real canton —
 * the engine must be proven canton-generic). Exercises: enum + boolean leaves,
 * a conditional group, a repeating group with a lexical reference to a parent
 * key, and a `complete` condition.
 */
export const testFlow: QuestionFlow = {
  nodes: [
    { kind: "boolean", key: "a", label: "A?" },
    { kind: "boolean", key: "b", label: "B?", visibleWhen: { type: "eq", key: "a", value: true } },
    {
      kind: "enum",
      key: "mode",
      label: "Mode",
      options: [
        { value: "one", label: "One" },
        { value: "two", label: "Two" },
      ],
      visibleWhen: { type: "eq", key: "b", value: true },
    },
    {
      kind: "group",
      key: "grp",
      label: "Group",
      visibleWhen: { type: "eq", key: "mode", value: "one" },
      flow: {
        nodes: [
          { kind: "boolean", key: "inner", label: "Inner?" },
          {
            kind: "boolean",
            key: "innerDep",
            label: "Inner dependent?",
            // Lexical reference to the parent scope's `a`.
            visibleWhen: {
              type: "all",
              conditions: [
                { type: "eq", key: "inner", value: true },
                { type: "eq", key: "a", value: true },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "repeatingGroup",
      key: "reps",
      label: "Items",
      itemLabel: "Item",
      minItems: 1,
      maxItems: 9,
      visibleWhen: { type: "eq", key: "a", value: false },
      itemFlow: {
        nodes: [
          { kind: "boolean", key: "x", label: "X?" },
          {
            kind: "boolean",
            key: "y",
            label: "Y?",
            // Lexical reference from item scope to top-level `a`.
            visibleWhen: {
              type: "all",
              conditions: [
                { type: "eq", key: "x", value: true },
                { type: "eq", key: "a", value: false },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "boolean",
      key: "final",
      label: "Final?",
      visibleWhen: {
        type: "any",
        conditions: [
          { type: "eq", key: "a", value: true },
          { type: "complete", key: "reps" },
        ],
      },
    },
  ],
};
