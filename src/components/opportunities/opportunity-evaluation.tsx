"use client";

import { useActionState } from "react";
import { evaluateOpportunity } from "@/app/actions/evaluation-actions";
import { recommendationLabels, type SavedEvaluation } from "@/schemas/opportunity-evaluation";

type OpportunityEvaluationProps = {
  opportunityId: number;
  hasDescription: boolean;
  savedEvaluation?: SavedEvaluation;
  loadError?: string | null;
};

export function OpportunityEvaluation({ opportunityId, hasDescription, savedEvaluation, loadError }: OpportunityEvaluationProps) {
  const [state, formAction, pending] = useActionState(evaluateOpportunity.bind(null, opportunityId), null);
  const evaluation = state?.status === "success" ? state.evaluation : savedEvaluation;

  return (
    <section className="evaluation" aria-label="Opportunity evaluation" aria-busy={pending}>
      <p className="eyebrow">Simulated evaluation</p>
      <p className="muted">Sample results only. No OpenAI calls or API charges.</p>
      {loadError && <p className="error-message" role="alert">{loadError}</p>}
      <div aria-live="polite">
        {pending && <p className="status">Running simulation and saving the result…</p>}
        {state?.status === "error" && <p className="error-message" role="alert">{state.message}</p>}
        {evaluation && (
          <>
            <h5>{recommendationLabels[evaluation.result.recommendation]} <span className="muted">(sample)</span></h5>
            <p>{evaluation.result.summary}</p>
            <p className="status">Supporting evidence</p>
            {evaluation.result.supportingEvidence.length > 0
              ? <ul>{evaluation.result.supportingEvidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
              : <p className="muted">No supporting evidence listed.</p>}
            <p className="status">Gaps and unknowns</p>
            {evaluation.result.gapsAndUnknowns.length > 0
              ? <ul>{evaluation.result.gapsAndUnknowns.map((item, index) => <li key={index}>{item}</li>)}</ul>
              : <p className="muted">No gaps or unknowns listed.</p>}
            <p className="muted">Saved <time dateTime={evaluation.evaluatedAt}>{evaluation.evaluatedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time></p>
          </>
        )}
      </div>
      <form action={formAction}>
        {evaluation && <input type="hidden" name="reevaluate" value="true" />}
        <button type="submit" disabled={pending || !hasDescription || Boolean(loadError)}>
          {pending ? "Running simulation…" : evaluation ? "Run simulation again" : "Evaluate (simulated)"}
        </button>
      </form>
      {!hasDescription && <p className="muted">Advertisement text is required for evaluation.</p>}
    </section>
  );
}
