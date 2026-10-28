"use client";

import { useCallback, useId, useState } from "react";
import type { Opportunity } from "@/schemas/opportunity";
import type { SavedEvaluation } from "@/schemas/opportunity-evaluation";
import { trackingLabels, type Tracking } from "@/schemas/opportunity-tracking";
import { OpportunityEvaluation } from "./opportunity-evaluation";
import { ApplicationDraft } from "./application-draft";
import { OpportunityTracking } from "./opportunity-tracking";
import styles from "./opportunity-card.module.css";

type OpportunityCardProps = {
  opportunity: Opportunity;
  savedEvaluation?: SavedEvaluation;
  evaluationError?: string | null;
  tracking?: Tracking;
  trackingError?: string | null;
  headingLevel?: "h3" | "h4";
  onDraftDirtyChange: (id: number, dirty: boolean) => void;
  onTrackingDirtyChange: (id: number, dirty: boolean) => void;
  onTrackingSaved: (tracking: Tracking) => void;
};

export function OpportunityCard({
  opportunity,
  savedEvaluation,
  evaluationError,
  tracking,
  trackingError,
  headingLevel: Heading = "h4",
  onDraftDirtyChange,
  onTrackingDirtyChange,
  onTrackingSaved,
}: OpportunityCardProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [draftActive, setDraftActive] = useState(false);
  const [trackingActive, setTrackingActive] = useState(false);
  const status = tracking?.status ?? (trackingError ? undefined : "to_review");

  // Surface editor activity even when its card is closed, preserving the list's existing guards.
  const reportDraftChange = useCallback((opportunityId: number, active: boolean) => {
    setDraftActive(active);
    onDraftDirtyChange(opportunityId, active);
  }, [onDraftDirtyChange]);

  const reportTrackingChange = useCallback((opportunityId: number, active: boolean) => {
    setTrackingActive(active);
    onTrackingDirtyChange(opportunityId, active);
  }, [onTrackingDirtyChange]);

  return (
    <article className={styles.card} data-tracking-status={status} aria-labelledby={`${id}-title`}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <Heading className={styles.title} id={`${id}-title`}>{opportunity.title}</Heading>
          <p className={styles.company}>{opportunity.company || "Company not provided"}</p>

          <div className={styles.metadata}>
            <span>{opportunity.location || "Location not provided"}</span>
            {opportunity.applicationDeadline && (
              <span>
                Apply by <time dateTime={opportunity.applicationDeadline} title={opportunity.applicationDeadline.replace("T", " ")}>
                  {opportunity.applicationDeadline.slice(0, 10)}
                </time>
              </span>
            )}
            {tracking?.appliedOn && (
              <span>Applied <time dateTime={tracking.appliedOn}>{tracking.appliedOn}</time></span>
            )}
          </div>

          {(draftActive || trackingActive) && (
            <p className={styles.editorNotice}>Editor in progress</p>
          )}
        </div>

        <div className={styles.controls}>
          <span className="status-badge" data-tracking-status={status}>
            {status ? trackingLabels[status] : "Status unavailable"}
          </span>

          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={expanded ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
          </svg>
        </div>

        {/* One button covers the summary; controls in the expanded body remain independent. */}
        <button
          className={styles.toggle}
          type="button"
          aria-expanded={expanded}
          aria-controls={`${id}-details`}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${opportunity.title}`}
          onClick={() => setExpanded((value) => !value)}
        />
      </header>

      {/* Keep editors mounted when collapsed so closing a card never discards work. */}
      <div className={styles.body} id={`${id}-details`} hidden={!expanded}>
        {opportunity.description ? (
          <details className="advertisement">
            <summary>Read advertisement</summary>
            <p className="ad-description">{opportunity.description}</p>
          </details>
        ) : (
          <p className="muted">Advertisement text is available at the original source.</p>
        )}

        <a className="source-link" href={opportunity.url} target="_blank" rel="noopener noreferrer">
          Open original advertisement <span aria-hidden="true">↗</span>
        </a>

        <div className="opportunity-workflow">
          <div className="opportunity-preparation">
            <OpportunityEvaluation
              opportunityId={opportunity.id}
              hasDescription={Boolean(opportunity.description?.trim())}
              savedEvaluation={savedEvaluation}
              loadError={evaluationError}
            />

            <ApplicationDraft
              opportunityId={opportunity.id}
              hasDescription={Boolean(opportunity.description?.trim())}
              onDirtyChange={reportDraftChange}
            />
          </div>

          <OpportunityTracking
            opportunityId={opportunity.id}
            savedTracking={tracking}
            loadError={trackingError}
            onSaved={onTrackingSaved}
            onDirtyChange={reportTrackingChange}
          />
        </div>
      </div>
    </article>
  );
}
