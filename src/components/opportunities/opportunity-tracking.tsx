"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { openTracking, saveOpportunityTracking } from "@/app/actions/tracking-actions";
import { trackingLabels, type Tracking, type TrackingDetails, type TrackingStatus } from "@/schemas/opportunity-tracking";

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function OpportunityTracking({ opportunityId, savedTracking, loadError, onSaved, onDirtyChange }: {
  opportunityId: number; savedTracking?: Tracking; loadError?: string | null;
  onSaved: (tracking: Tracking) => void; onDirtyChange: (id: number, dirty: boolean) => void;
}) {
  const id = useId();
  const [details, setDetails] = useState<TrackingDetails | null>(null);
  const [status, setStatus] = useState<TrackingStatus>("to_review");
  const [appliedOn, setAppliedOn] = useState("");
  const [notes, setNotes] = useState("");
  const [allowReopen, setAllowReopen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = Boolean(details && (status !== details.tracking.status || appliedOn !== (details.tracking.appliedOn ?? "") || notes !== details.tracking.notes));
  const busyOrDirty = dirty || (Boolean(details) && pending);
  const displayTracking = details && details.tracking.revision >= (savedTracking?.revision ?? 0) ? details.tracking : savedTracking;

  useEffect(() => { onDirtyChange(opportunityId, busyOrDirty); }, [onDirtyChange, opportunityId, busyOrDirty]);
  useEffect(() => {
    if (!busyOrDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busyOrDirty]);

  function accept(value: TrackingDetails) {
    setDetails(value); setStatus(value.tracking.status); setAppliedOn(value.tracking.appliedOn ?? "");
    setNotes(value.tracking.notes); setAllowReopen(false);
  }
  function run(task: () => Promise<void>) {
    setError(""); setMessage("");
    startTransition(async () => { try { await task(); } catch { setError("Tracking could not be updated. Your editor is unchanged. Please try again."); } });
  }
  function open() {
    if (dirty && !allowReopen) return;
    run(async () => {
      const result = await openTracking(opportunityId);
      if (result.status === "error") { setError(result.message); return; }
      accept(result.details);
    });
  }

  return <section className="evaluation" aria-label="Opportunity tracking" aria-busy={pending}>
    <p className="eyebrow">Your tracking</p>
    <p className="status">Status: {trackingLabels[displayTracking?.status ?? "to_review"]}</p>
    {loadError && <p className="error-message">{loadError}</p>}
    {!details && <button type="button" onClick={open} disabled={pending}>{pending ? "Opening…" : "Manage tracking"}</button>}
    {details && <>
      <p className="muted">Mark Applied after submitting yourself. Notes stay on this computer and are not sent to AI.</p>
      <fieldset className="search-fields" disabled={pending}>
        <div className="field">
          <label htmlFor={`${id}-status`}>Application status</label>
          <select id={`${id}-status`} value={status} onChange={(event) => {
            const next = event.target.value as TrackingStatus;
            setStatus(next); setAllowReopen(false);
            if (next === "applied" && !appliedOn) setAppliedOn(today());
          }}>
            {Object.entries(trackingLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-date`}>Date applied (optional)</label>
          <input id={`${id}-date`} type="date" value={appliedOn} onChange={(event) => { setAppliedOn(event.target.value); setAllowReopen(false); }} />
          <p className="muted">Applied suggests today. Change it for an earlier application, or clear it if the date is unknown. Later status changes keep this date.</p>
        </div>
        <div className="field">
          <label htmlFor={`${id}-notes`}>Tracking notes</label>
          <textarea id={`${id}-notes`} rows={4} maxLength={6000} value={notes} onChange={(event) => { setNotes(event.target.value); setAllowReopen(false); }} />
          <p className="muted">{notes.length}/6,000 characters. Use notes for feedback or why you skipped or closed an opportunity.</p>
        </div>
        {dirty && <>
          <p className="status">Unsaved tracking changes.</p>
          <label className="location-option"><input type="checkbox" checked={allowReopen} onChange={(event) => setAllowReopen(event.target.checked)} />Discard my unsaved tracking changes when reopening.</label>
        </>}
        <button type="button" disabled={!dirty} onClick={() => run(async () => {
          const result = await saveOpportunityTracking(opportunityId, { status, appliedOn: appliedOn || null, notes }, details.tracking.revision);
          if (result.status === "error") { setError(result.message); return; }
          accept(result.details); onSaved(result.details.tracking); setMessage("Tracking saved.");
        })}>{pending ? "Saving…" : "Save tracking"}</button>
        <button type="button" onClick={open} disabled={dirty && !allowReopen}>Reopen saved tracking</button>
      </fieldset>
      <details className="tracking-history">
        <summary>Status history ({details.historyCount})</summary>
        <p className="muted">Dates below show when changes were recorded. The application date is separate.</p>
        {details.history.length === 0 ? <p className="muted">No status changes recorded yet.</p> : <ol>
          {details.history.map((entry) => <li key={entry.id}>{trackingLabels[entry.fromStatus]} → {trackingLabels[entry.toStatus]}
            <br /><time dateTime={entry.changedAt}>{entry.changedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time></li>)}
        </ol>}
        {details.historyCount > details.history.length && <p className="muted">Showing the latest 25 changes. All changes remain saved.</p>}
      </details>
    </>}
    <div aria-live="polite">{error && <p className="error-message" role="alert">{error}</p>}{message && <p className="status">{message}</p>}</div>
  </section>;
}
