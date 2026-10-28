"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { loadTrackedOpportunities } from "@/app/actions/tracking-actions";
import { trackingLabels, trackingPageSize, type Tracking, type TrackingFilter, type TrackingMap, type TrackingPage } from "@/schemas/opportunity-tracking";
import { OpportunityList } from "./opportunity-list";

export function TrackedOpportunities({
  changeVersion,
  updates,
  onTrackingSaved,
}: {
  changeVersion: number;
  updates: TrackingMap;
  onTrackingSaved: (tracking: Tracking) => void;
}) {
  const [filter, setFilter] = useState<TrackingFilter>("tracked");
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<TrackingPage | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState<Set<string>>(() => new Set());

  // Collect changes from both editors before allowing the list to refresh or change pages.
  const updateDirty = useCallback((key: string, value: boolean) => setDirty((current) => {
    if (current.has(key) === value) return current;

    const next = new Set(current);
    if (value) next.add(key); else next.delete(key);

    return next;
  }), []);

  const onDraftDirtyChange = useCallback((id: number, value: boolean) => updateDirty(`draft:${id}`, value), [updateDirty]);
  const onTrackingDirtyChange = useCallback((id: number, value: boolean) => updateDirty(`tracking:${id}`, value), [updateDirty]);
  const hasDirty = dirty.size > 0;

  // Reload the selected view when editors are safe, ignoring responses from an obsolete view.
  useEffect(() => {
    if (hasDirty) return;

    let active = true;

    startTransition(async () => {
      try {
        const result = await loadTrackedOpportunities(filter, offset);

        if (!active) return;

        if (result.status === "success" && result.page.items.length === 0 && offset > 0) {
          const last = Math.max(0, (Math.ceil(result.page.total / trackingPageSize) - 1) * trackingPageSize);
          setOffset(last);
          return;
        }

        if (result.status === "error") {
          setError(result.message);
          return;
        }

        setPage(result.page);
        setError("");
      } catch {
        if (active) setError("The tracking list could not be loaded. Please try again.");
      }
    });

    return () => {
      active = false;
    };
  }, [filter, offset, changeVersion, refresh, hasDirty]);

  const tracking: TrackingMap = {};

  for (const item of page?.items ?? []) {
    const changed = updates[item.opportunity.id];
    tracking[item.opportunity.id] = changed && changed.revision > item.tracking.revision ? changed : item.tracking;
  }

  return (
    <section className="card" aria-labelledby="tracking-heading" aria-busy={pending}>
      <p className="eyebrow">Your job search</p>
      <h2 id="tracking-heading">Tracked opportunities</h2>

      <p className="muted">
        Revisit saved opportunities, applications and drafts independently of your latest search.
        To review includes saved ads you have not marked yet.
      </p>

      <fieldset className="search-fields" disabled={pending || hasDirty}>
        <div className="field">
          <label htmlFor="tracking-filter">Filter by status</label>
          <select
            id="tracking-filter"
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as TrackingFilter);
              setOffset(0);
            }}
          >
            <option value="tracked">All tracked</option>
            {Object.entries(trackingLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <button type="button" onClick={() => setRefresh((value) => value + 1)}>
          Refresh tracking list
        </button>
      </fieldset>

      {hasDirty && <p className="muted">Finish saving or reopen your unsaved edits below before changing this list.</p>}

      <div aria-live="polite">
        {pending && <p className="status">Loading tracking…</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
        {page && (
          <p className="status">
            {page.items.length ? `${page.offset + 1}–${page.offset + page.items.length}` : "0"} of {page.total} opportunities · {page.filter === "tracked" ? "All tracked" : trackingLabels[page.filter]}
          </p>
        )}
      </div>

      {page?.items.length === 0 && (
        <p className="muted">
          No opportunities in this view. Mark a saved advertisement Interested, or choose another status filter.
        </p>
      )}

      <ul className="opportunity-list">
        {page?.items.map(({ opportunity }) => (
          <li key={opportunity.id} className="opportunity">
            <h3>{opportunity.title}</h3>
            <p>{opportunity.company ?? "Company not provided"} · {trackingLabels[tracking[opportunity.id].status]}</p>
            {tracking[opportunity.id].appliedOn && (
              <p className="muted">Applied: {tracking[opportunity.id].appliedOn}</p>
            )}
            {opportunity.applicationDeadline && (
              <p className="muted">Deadline: {opportunity.applicationDeadline.replace("T", " ")}</p>
            )}

            <details>
              <summary>Open saved opportunity</summary>

              <OpportunityList
                opportunities={[opportunity]}
                evaluations={page.evaluations}
                evaluationError={page.evaluationError}
                tracking={tracking}
                onTrackingSaved={onTrackingSaved}
                onTrackingDirtyChange={onTrackingDirtyChange}
                onDraftDirtyChange={onDraftDirtyChange}
                emptyMessage=""
              />
            </details>
          </li>
        ))}
      </ul>

      {page && (
        <div className="tracking-pages">
          <button
            type="button"
            disabled={pending || hasDirty || page.offset === 0}
            onClick={() => setOffset(Math.max(0, page.offset - trackingPageSize))}
          >
            Previous page
          </button>

          <button
            type="button"
            disabled={pending || hasDirty || page.nextOffset === null}
            onClick={() => setOffset(page.nextOffset!)}
          >
            Next page
          </button>
        </div>
      )}
    </section>
  );
}
