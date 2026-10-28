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

export function OpportunityEvaluation({
  opportunityId,
  hasDescription,
  savedEvaluation,
  loadError,
}: OpportunityEvaluationProps) {
  const [state, formAction, pending] = useActionState(evaluateOpportunity.bind(null, opportunityId), null);
  const evaluation = state?.status === "success" ? state.evaluation : savedEvaluation;

  return (
    <section className="workflow-section opportunity-evaluation" aria-label="Opportunity evaluation" aria-busy={pending}>
      <h5 className="workflow-heading">Opportunity evaluation</h5>

      <p className="muted">
        Evaluate this advertisement with GPT-6.1 Sol using your ChatGPT subscription.
        Review the result before deciding whether to apply.
      </p>

      <details className="request-details">
        <summary>About this evaluation</summary>
        <p className="muted">
          Sends skills and competencies, professional experience, education, and career preferences.
          Personality and interests are excluded. One request per attempt. No automatic retries or paid API fallback.
        </p>
      </details>

      {loadError && <p className="error-message" role="alert">{loadError}</p>}

      <div aria-live="polite">
        {pending && <p className="status status-running">Evaluating with ChatGPT and saving the result…</p>}
        {state?.status === "error" && <p className="error-message" role="alert">{state.message}</p>}

        {evaluation && (
          <>
            {evaluation.mode === "simulated" && <p className="notice-message">Saved sample — no suitability assessment was made.</p>}
            {evaluation.mode === "live" && <p className="status status-success">AI evaluation · {evaluation.model}</p>}

            <p className="recommendation" data-recommendation={evaluation.mode === "live" ? evaluation.result.recommendation : undefined}>
              {recommendationLabels[evaluation.result.recommendation]} {evaluation.mode === "simulated" && <span className="muted">(sample)</span>}
            </p>
            <p>{evaluation.result.summary}</p>

            <div className="evidence-columns">
              <div>
                <p className="status">Supporting evidence</p>
                {evaluation.result.supportingEvidence.length > 0 ? (
                  <ul>
                    {evaluation.result.supportingEvidence.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No supporting evidence listed.</p>
                )}
              </div>

              <div>
                <p className="status">Gaps and unknowns</p>
                {evaluation.result.gapsAndUnknowns.length > 0 ? (
                  <ul>
                    {evaluation.result.gapsAndUnknowns.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No gaps or unknowns listed.</p>
                )}
              </div>
            </div>

            <p className="muted">Saved <time dateTime={evaluation.evaluatedAt}>{evaluation.evaluatedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time></p>
          </>
        )}
      </div>

      <form action={formAction}>
        {evaluation && <input type="hidden" name="reevaluate" value="true" />}

        <button className={evaluation?.mode === "live" ? undefined : "button-primary"} type="submit" disabled={pending || !hasDescription || Boolean(loadError)}>
          {pending ? "Evaluating…" : evaluation?.mode === "live" ? "Evaluate again with ChatGPT" : "Evaluate with ChatGPT"}
        </button>
      </form>

      {!hasDescription && <p className="muted">Advertisement text is required for evaluation.</p>}
    </section>
  );
}
