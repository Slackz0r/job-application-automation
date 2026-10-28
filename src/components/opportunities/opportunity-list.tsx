import type { Opportunity } from "@/schemas/opportunity";
import type { EvaluationMap } from "@/schemas/opportunity-evaluation";
import { OpportunityCard } from "./opportunity-card";
import type { Tracking, TrackingMap } from "@/schemas/opportunity-tracking";

type OpportunityListProps = {
  opportunities: Opportunity[];
  emptyMessage: string;
  evaluations: EvaluationMap;
  evaluationError?: string | null;
  onDraftDirtyChange: (id: number, dirty: boolean) => void;
  tracking: TrackingMap;
  trackingError?: string | null;
  onTrackingDirtyChange: (id: number, dirty: boolean) => void;
  onTrackingSaved: (tracking: Tracking) => void;
  headingLevel?: "h3" | "h4";
};

export function OpportunityList({
  opportunities,
  emptyMessage,
  evaluations,
  evaluationError,
  onDraftDirtyChange,
  tracking,
  trackingError,
  onTrackingDirtyChange,
  onTrackingSaved,
  headingLevel,
}: OpportunityListProps) {
  if (opportunities.length === 0) {
    return emptyMessage ? <p className="muted">{emptyMessage}</p> : null;
  }

  return (
    <ul className="opportunity-list">
      {opportunities.map((opportunity) => (
        <li key={opportunity.id} className="opportunity">
          <OpportunityCard
            opportunity={opportunity}
            savedEvaluation={evaluations[opportunity.id]}
            evaluationError={evaluationError}
            tracking={tracking[opportunity.id]}
            trackingError={trackingError}
            headingLevel={headingLevel}
            onDraftDirtyChange={onDraftDirtyChange}
            onTrackingDirtyChange={onTrackingDirtyChange}
            onTrackingSaved={onTrackingSaved}
          />
        </li>
      ))}
    </ul>
  );
}
