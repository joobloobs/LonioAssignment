"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { AnswersDoc } from "@lonio-poc/engine-core";
import { evaluate, restrictToReachable } from "@lonio-poc/engine-core";
import { cantonRegistry, SWISS_NATIONALITY } from "@/cantons";
import { COUNTRIES } from "@/countries";
import type { CreateEmployeeError, CreateEmployeeSuccess } from "@/contracts";
import { describeOutcome } from "@/lib/outcome";
import { FlowRenderer } from "./FlowRenderer";

export function OnboardingForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nationality, setNationality] = useState("");
  const [canton, setCanton] = useState("ZH");
  const [rawAnswers, setRawAnswers] = useState<AnswersDoc>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>(undefined);
  const [submittedId, setSubmittedId] = useState<string | undefined>(undefined);

  const module_ = cantonRegistry.get(canton);
  const needsQuestionnaire = nationality !== "" && nationality !== SWISS_NATIONALITY;

  // The raw local answers keep temporarily-hidden values (vendor-faithful UX);
  // the engine only ever sees the reachable subset.
  const effectiveAnswers = useMemo(
    () => (module_ && needsQuestionnaire ? restrictToReachable(module_.flow, rawAnswers) : {}),
    [module_, needsQuestionnaire, rawAnswers],
  );
  const evaluation = useMemo(
    () => (module_ && needsQuestionnaire ? evaluate(module_, effectiveAnswers) : undefined),
    [module_, needsQuestionnaire, effectiveAnswers],
  );

  const personalValid = firstName.trim() !== "" && lastName.trim() !== "" && nationality !== "";
  const canSubmit =
    personalValid &&
    !submitting &&
    (!needsQuestionnaire || (module_ !== undefined && evaluation?.status === "complete"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setServerError(undefined);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          nationality,
          canton,
          ...(needsQuestionnaire ? { answers: effectiveAnswers } : {}),
        }),
      });
      if (res.status === 201) {
        const data = (await res.json()) as CreateEmployeeSuccess;
        setSubmittedId(data.id);
        return;
      }
      const err = (await res.json()) as CreateEmployeeError;
      setServerError(
        err.error === "badRequest"
          ? `Invalid request: ${err.detail.join("; ")}`
          : err.error === "unsupportedCanton"
            ? `Canton ${err.canton} is not supported yet`
            : `Submission rejected (${err.error}): ${err.keys.join(", ")}`,
      );
    } catch {
      setServerError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setFirstName("");
    setLastName("");
    setNationality("");
    setRawAnswers({});
    setSubmittedId(undefined);
    setServerError(undefined);
  }

  if (submittedId) {
    return (
      <div className="card success">
        <h2>Onboarding complete</h2>
        <p>
          {firstName} {lastName} has been registered.
        </p>
        {needsQuestionnaire && evaluation?.status === "complete" && (
          <OutcomePanel evaluation={evaluation} />
        )}
        <div className="actions">
          <Link className="btn" href="/dashboard">
            Open HR dashboard
          </Link>
          <button type="button" className="btn-subtle" onClick={reset}>
            Onboard another employee
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="card">
        <h2>Personal data</h2>
        <div className="field-row">
          <label className="field">
            <span>First name</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label className="field">
            <span>Last name</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Nationality</span>
            <select value={nationality} onChange={(e) => setNationality(e.target.value)} required>
              <option value="" disabled>
                Select…
              </option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Work canton</span>
            <select value={canton} onChange={(e) => setCanton(e.target.value)}>
              {cantonRegistry.supported().map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.id})
                </option>
              ))}
            </select>
          </label>
        </div>
        {nationality === SWISS_NATIONALITY && (
          <p className="notice">Swiss citizens are not subject to source tax — no further questions.</p>
        )}
      </div>

      {needsQuestionnaire && module_ && (
        <div className="card">
          <h2>Source tax questionnaire — {module_.cantonLabel}</h2>
          <FlowRenderer flow={module_.flow} value={rawAnswers} onChange={setRawAnswers} />
          {evaluation && <OutcomePanel evaluation={evaluation} />}
        </div>
      )}

      {serverError && <p className="error-banner">{serverError}</p>}

      <div className="actions">
        <button className="btn" type="submit" disabled={!canSubmit}>
          {submitting ? "Submitting…" : "Submit onboarding"}
        </button>
      </div>
    </form>
  );
}

function OutcomePanel({ evaluation }: { evaluation: ReturnType<typeof evaluate> }) {
  if (evaluation.status === "incomplete") {
    return (
      <div className="outcome pending">
        {evaluation.missingKeys.length} question{evaluation.missingKeys.length === 1 ? "" : "s"}{" "}
        remaining
      </div>
    );
  }
  if (evaluation.status !== "complete") return null;
  const view = describeOutcome(evaluation.outcome);
  return (
    <div className="outcome done">
      <span className="outcome-label">Suggested tariff&nbsp;</span>
      {view.kind === "code" ? (
        <span className="code-badge">{view.main}</span>
      ) : (
        <span className="ruling">{view.main}</span>
      )}
      {view.remark && <div className="remark">{view.remark}</div>}
    </div>
  );
}
