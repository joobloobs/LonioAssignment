"use client";

import type {
  AnswerPrimitive,
  AnswersDoc,
  QuestionFlow,
  RepeatingGroupQuestion,
  Scope,
} from "@lonio-poc/engine-core";
import { isNodeVisible, parsePath, setAtPath } from "@lonio-poc/engine-core";

/**
 * Canton-agnostic form renderer: interprets any QuestionFlow.
 *
 * `value` must already be reachability-restricted (the parent re-applies
 * `restrictToReachable` on every edit). isNodeVisible only checks a node's own
 * condition, so an unrestricted document renders *orphans* — questions whose
 * condition still passes because the answer it names is itself no longer
 * reachable. Feeding this component the same fixpoint document the engine sees
 * makes that state unrepresentable.
 */
export interface FlowRendererProps {
  flow: QuestionFlow;
  value: AnswersDoc;
  onChange: (next: AnswersDoc) => void;
}

export function FlowRenderer({ flow, value, onChange }: FlowRendererProps) {
  const setLeaf = (path: string, v: AnswerPrimitive) =>
    onChange(setAtPath(value, parsePath(path), v));
  const setItems = (path: string, items: AnswersDoc[]) =>
    onChange(setAtPath(value, parsePath(path), items));

  return (
    <div className="flow">
      <FlowNodes
        flow={flow}
        doc={value}
        chain={[{ flow, doc: value }]}
        prefix=""
        setLeaf={setLeaf}
        setItems={setItems}
      />
    </div>
  );
}

interface NodesProps {
  flow: QuestionFlow;
  doc: AnswersDoc;
  chain: Scope[];
  prefix: string;
  setLeaf: (path: string, v: AnswerPrimitive) => void;
  setItems: (path: string, items: AnswersDoc[]) => void;
}

function FlowNodes({ flow, doc, chain, prefix, setLeaf, setItems }: NodesProps) {
  return (
    <>
      {flow.nodes.map((node) => {
        if (!isNodeVisible(node, chain)) return null;
        const path = `${prefix}${node.key}`;
        switch (node.kind) {
          case "boolean":
            return (
              <RadioQuestion
                key={path}
                path={path}
                label={node.label}
                help={node.help}
                options={[
                  { value: true, label: node.trueLabel ?? "Yes" },
                  { value: false, label: node.falseLabel ?? "No" },
                ]}
                current={doc[node.key]}
                onSelect={(v) => setLeaf(path, v)}
              />
            );
          case "enum":
            return (
              <RadioQuestion
                key={path}
                path={path}
                label={node.label}
                help={node.help}
                options={node.options.map((o) => ({ value: o.value, label: o.label, help: o.help }))}
                current={doc[node.key]}
                onSelect={(v) => setLeaf(path, v)}
              />
            );
          case "group": {
            const sub = (doc[node.key] ?? {}) as AnswersDoc;
            return (
              <fieldset key={path} className="group">
                <legend>{node.label}</legend>
                <FlowNodes
                  flow={node.flow}
                  doc={sub}
                  chain={[...chain, { flow: node.flow, doc: sub }]}
                  prefix={`${path}.`}
                  setLeaf={setLeaf}
                  setItems={setItems}
                />
              </fieldset>
            );
          }
          case "repeatingGroup":
            return (
              <RepeatingGroup
                key={path}
                node={node}
                path={path}
                items={(doc[node.key] ?? []) as AnswersDoc[]}
                chain={chain}
                setLeaf={setLeaf}
                setItems={setItems}
              />
            );
        }
      })}
    </>
  );
}

interface RepeatingGroupProps {
  node: RepeatingGroupQuestion;
  path: string;
  items: AnswersDoc[];
  chain: Scope[];
  setLeaf: (path: string, v: AnswerPrimitive) => void;
  setItems: (path: string, items: AnswersDoc[]) => void;
}

function RepeatingGroup({ node, path, items, chain, setLeaf, setItems }: RepeatingGroupProps) {
  // Display at least minItems item forms; the underlying array only grows when
  // an answer is actually given inside an item.
  const display: AnswersDoc[] =
    items.length >= node.minItems
      ? items
      : [...items, ...Array.from({ length: node.minItems - items.length }, () => ({}))];

  return (
    <fieldset className="group repeating">
      <legend>{node.label}</legend>
      {display.map((item, i) => (
        <div key={`${path}-${i}`} className="repeating-item">
          <div className="repeating-item-header">
            <span>
              {node.itemLabel} {i + 1}
            </span>
            {items.length > node.minItems && i < items.length && (
              <button
                type="button"
                className="btn-subtle"
                onClick={() => setItems(path, items.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            )}
          </div>
          <FlowNodes
            flow={node.itemFlow}
            doc={item}
            chain={[...chain, { flow: node.itemFlow, doc: item }]}
            prefix={`${path}[${i}].`}
            setLeaf={setLeaf}
            setItems={setItems}
          />
        </div>
      ))}
      {display.length < node.maxItems && (
        <button
          type="button"
          className="btn-subtle add-item"
          onClick={() => setItems(path, [...display, {}])}
        >
          + Add {node.itemLabel.toLowerCase()}
        </button>
      )}
    </fieldset>
  );
}

interface RadioQuestionProps {
  path: string;
  label: string;
  help?: string | undefined;
  options: { value: AnswerPrimitive; label: string; help?: string | undefined }[];
  current: AnswersDoc[string];
  onSelect: (v: AnswerPrimitive) => void;
}

function RadioQuestion({ path, label, help, options, current, onSelect }: RadioQuestionProps) {
  return (
    <div className="question" data-path={path}>
      <div className="question-label">{label}</div>
      {help && <div className="question-help">{help}</div>}
      <div className="options">
        {options.map((opt) => {
          const id = `${path}--${String(opt.value)}`;
          return (
            <label key={id} htmlFor={id} className={current === opt.value ? "option selected" : "option"}>
              <input
                type="radio"
                id={id}
                name={path}
                checked={current === opt.value}
                onChange={() => onSelect(opt.value)}
              />
              <span>
                {opt.label}
                {opt.help && <small>{opt.help}</small>}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
