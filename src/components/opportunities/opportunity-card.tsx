"use client";

import { useCallback, useId, useState, type KeyboardEvent } from "react";
import type { Opportunity } from "@/schemas/opportunity";
import type { SavedEvaluation } from "@/schemas/opportunity-evaluation";
import { trackingLabels, type Tracking } from "@/schemas/opportunity-tracking";
import { OpportunityEvaluation } from "./opportunity-evaluation";
import { ApplicationDraft } from "./application-draft";
import { OpportunityTracking } from "./opportunity-tracking";
import styles from "./opportunity-card.module.css";

const detailTabs = [
  { id: "advertisement", label: "Advertisement" },
  { id: "evaluation", label: "Evaluation" },
  { id: "application", label: "Application" },
  { id: "tracking", label: "Tracking" },
] as const;

type DetailTab = typeof detailTabs[number]["id"];

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
  const [activeTab, setActiveTab] = useState<DetailTab>("advertisement");
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

  // Arrow keys, Home and End move between the already-mounted detail panels.
  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % detailTabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + detailTabs.length) % detailTabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = detailTabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextTab = detailTabs[nextIndex].id;
    setActiveTab(nextTab);
    document.getElementById(`${id}-${nextTab}-tab`)?.focus();
  }

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

      {/* Closing cards and switching tabs hide panels without discarding editor state. */}
      <div className={styles.body} id={`${id}-details`} hidden={!expanded}>
        <div className={styles.tabs} role="tablist" aria-label="Opportunity details">
          {detailTabs.map((tab, index) => (
            <button
              className={styles.tab}
              key={tab.id}
              type="button"
              role="tab"
              id={`${id}-${tab.id}-tab`}
              aria-selected={activeTab === tab.id}
              aria-controls={`${id}-${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => navigateTabs(event, index)}
            >
              {tab.label}
              {((tab.id === "application" && draftActive) || (tab.id === "tracking" && trackingActive)) && (
                <span className={styles.activityMarker} role="img" aria-label="Editor in progress">•</span>
              )}
            </button>
          ))}
        </div>

        <div
          className={styles.panel}
          role="tabpanel"
          id={`${id}-advertisement-panel`}
          aria-labelledby={`${id}-advertisement-tab`}
          hidden={activeTab !== "advertisement"}
          tabIndex={0}
        >
          <div className={styles.readingContent}>
            <div className={styles.advertisementHeading}>
              <h5 className="workflow-heading">Advertisement</h5>
              <a className={styles.sourceLink} href={opportunity.url} target="_blank" rel="noopener noreferrer">
                Open original advertisement <span aria-hidden="true">↗</span>
              </a>
            </div>

            {opportunity.description ? (
              <p className="ad-description">{opportunity.description}</p>
            ) : (
              <p className="muted">Advertisement text is available at the original source.</p>
            )}
          </div>
        </div>

        <div
          className={styles.panel}
          role="tabpanel"
          id={`${id}-evaluation-panel`}
          aria-labelledby={`${id}-evaluation-tab`}
          hidden={activeTab !== "evaluation"}
          tabIndex={0}
        >
          <OpportunityEvaluation
            opportunityId={opportunity.id}
            hasDescription={Boolean(opportunity.description?.trim())}
            savedEvaluation={savedEvaluation}
            loadError={evaluationError}
          />
        </div>

        <div
          className={styles.panel}
          role="tabpanel"
          id={`${id}-application-panel`}
          aria-labelledby={`${id}-application-tab`}
          hidden={activeTab !== "application"}
          tabIndex={0}
        >
          <ApplicationDraft
            opportunityId={opportunity.id}
            hasDescription={Boolean(opportunity.description?.trim())}
            onDirtyChange={reportDraftChange}
          />
        </div>

        <div
          className={styles.panel}
          role="tabpanel"
          id={`${id}-tracking-panel`}
          aria-labelledby={`${id}-tracking-tab`}
          hidden={activeTab !== "tracking"}
          tabIndex={0}
        >
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
