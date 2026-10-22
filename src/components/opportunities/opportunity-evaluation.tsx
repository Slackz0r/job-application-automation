"use client";

import { useActionState } from "react";
import { compareOpportunity, evaluateOpportunity } from "@/app/actions/evaluation-actions";
import { evaluationModel, recommendationLabels, type EvaluationResult, type SavedEvaluation } from "@/schemas/opportunity-evaluation";

type OpportunityEvaluationProps = {
  opportunityId: number;
  hasDescription: boolean;
  savedEvaluation?: SavedEvaluation;
  loadError?: string | null;
};

function EvaluationDetails({ result, sample = false }: { result: EvaluationResult; sample?: boolean }) {
  return <>
    <h5>{recommendationLabels[result.recommendation]} {sample && <span className="muted">(sample)</span>}</h5>
    <p>{result.summary}</p>
    <p className="status">Supporting evidence</p>
    {result.supportingEvidence.length > 0
      ? <ul>{result.supportingEvidence.map((item, index) => <li key={index}>{item}</li>)}</ul>
      : <p className="muted">No supporting evidence listed.</p>}
    <p className="status">Gaps and unknowns</p>
    {result.gapsAndUnknowns.length > 0
      ? <ul>{result.gapsAndUnknowns.map((item, index) => <li key={index}>{item}</li>)}</ul>
      : <p className="muted">No gaps or unknowns listed.</p>}
  </>;
}

export function OpportunityEvaluation({ opportunityId, hasDescription, savedEvaluation, loadError }: OpportunityEvaluationProps) {
  const [state, formAction, pending] = useActionState(evaluateOpportunity.bind(null, opportunityId), null);
  const [comparisonState, compareAction, comparing] = useActionState(compareOpportunity.bind(null, opportunityId), null);
  const evaluation = state?.status === "success" ? state.evaluation : savedEvaluation;
  const canCompare = evaluation?.mode === "live" && evaluation.model === evaluationModel;
  const comparison = comparisonState?.status === "success" && comparisonState.comparison.baselineEvaluatedAt === evaluation?.evaluatedAt
    ? comparisonState.comparison : null;

  return (
    <section className="evaluation" aria-label="Opportunity evaluation" aria-busy={pending || comparing}>
      <p className="eyebrow">Opportunity evaluation</p>
      <p className="muted">Evaluate this advertisement with GPT-6.1 Sol using your ChatGPT subscription. Sends skills and competencies, professional experience, education, and career preferences. Personality and interests are excluded.</p>
      <p className="muted">One request per attempt. No automatic retries or paid API fallback. Review the result before deciding whether to apply.</p>
      {loadError && <p className="error-message" role="alert">{loadError}</p>}
      <div aria-live="polite">
        {pending && <p className="status">Evaluating with ChatGPT and saving the result…</p>}
        {state?.status === "error" && <p className="error-message" role="alert">{state.message}</p>}
        {evaluation && (
          <>
            {evaluation.mode === "simulated" && <p className="status">Saved sample — no suitability assessment was made.</p>}
            {evaluation.mode === "live" && <p className="status">AI evaluation · {evaluation.model}</p>}
            <EvaluationDetails result={evaluation.result} sample={evaluation.mode === "simulated"} />
            <p className="muted">Saved <time dateTime={evaluation.evaluatedAt}>{evaluation.evaluatedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time></p>
          </>
        )}
      </div>
      <form action={formAction}>
        {evaluation && <input type="hidden" name="reevaluate" value="true" />}
        <button type="submit" disabled={pending || comparing || !hasDescription || Boolean(loadError)}>
          {pending ? "Evaluating…" : evaluation?.mode === "live" ? "Evaluate again with ChatGPT" : "Evaluate with ChatGPT"}
        </button>
      </form>
      {canCompare && <div className="connection-test">
        <p className="status">Temporary Luna comparison</p>
        <p className="muted">Try GPT-6 Luna below your saved Sol result. One subscription request per attempt; the saved result stays intact. The Luna result disappears on refresh.</p>
        <p className="muted">Luna uses your current profile and evaluation instructions. Keep them unchanged between runs for a fair comparison; an older Sol result may use different inputs.</p>
        <div aria-live="polite">
          {comparing && <p className="status">Evaluating with Luna…</p>}
          {comparisonState?.status === "error" && <p className="error-message" role="alert">{comparisonState.message}</p>}
          {comparisonState?.status === "success" && !comparison && <p className="muted">The Sol result changed. Run a new comparison against the current result.</p>}
          {comparison && <>
            <p className="status">Luna comparison · {comparison.model}</p>
            <EvaluationDetails result={comparison.result} />
            <p className="muted">Completed <time dateTime={comparison.comparedAt}>{comparison.comparedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time>. Luna request took {(comparison.elapsedMs / 1000).toFixed(1)} seconds.</p>
          </>}
        </div>
        {!comparison && <form action={compareAction}>
          <button type="submit" disabled={pending || comparing || !hasDescription || Boolean(loadError)}>
            {comparing ? "Comparing with Luna…" : "Compare with GPT-6 Luna"}
          </button>
        </form>}
      </div>}
      {!hasDescription && <p className="muted">Advertisement text is required for evaluation.</p>}
    </section>
  );
}
