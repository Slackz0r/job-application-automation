import type { Opportunity } from "@/schemas/opportunity";
import type { EvaluationMap } from "@/schemas/opportunity-evaluation";
import { OpportunityEvaluation } from "./opportunity-evaluation";

type OpportunityListProps = {
  opportunities: Opportunity[];
  emptyMessage: string;
  evaluations: EvaluationMap;
  evaluationError?: string | null;
};

export function OpportunityList({ opportunities, emptyMessage, evaluations, evaluationError }: OpportunityListProps) {
  if (opportunities.length === 0) {
    return <p className="muted">{emptyMessage}</p>;
  }

  return (
    <ul className="opportunity-list">
      {opportunities.map((opportunity) => (
        <li key={opportunity.id} className="opportunity">
          <h4>{opportunity.title}</h4>
          <p className="company">{opportunity.company || "Company not provided"}</p>
          <p className="location muted">Location: {opportunity.location || "Not provided"}</p>
          {opportunity.applicationDeadline && <p className="muted">
            Apply by <time dateTime={opportunity.applicationDeadline}>{opportunity.applicationDeadline.replace("T", " ")}</time>
          </p>}
          {opportunity.description ? (
            <details>
              <summary>Read advertisement</summary>
              <p className="ad-description">{opportunity.description}</p>
            </details>
          ) : <p className="muted">Advertisement text is available at the original source.</p>}
          <a href={opportunity.url} target="_blank" rel="noopener noreferrer">Open original advertisement <span aria-hidden="true">↗</span></a>
          <OpportunityEvaluation
            opportunityId={opportunity.id}
            hasDescription={Boolean(opportunity.description?.trim())}
            savedEvaluation={evaluations[opportunity.id]}
            loadError={evaluationError}
          />
        </li>
      ))}
    </ul>
  );
}
