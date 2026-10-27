"use client";

import { useActionState, useCallback, useState } from "react";
import type { Municipality } from "@/schemas/job-search";
import type { Opportunity } from "@/schemas/opportunity";
import type { EvaluationMap } from "@/schemas/opportunity-evaluation";
import { searchOpportunities, type SearchState } from "@/app/actions/opportunity-actions";
import { LocationPicker } from "./location-picker";
import { OpportunityList } from "./opportunity-list";

type OpportunityDiscoveryProps = {
  municipalities: Municipality[];
  savedOpportunities: Opportunity[];
  savedError: string | null;
  savedEvaluations: EvaluationMap;
  evaluationError: string | null;
};

type DiscoveryState = { result: Extract<SearchState, { status: "success" }> | null; error: string | null };
const initialState: DiscoveryState = { result: null, error: null };

export function OpportunityDiscovery({ municipalities, savedOpportunities, savedError, savedEvaluations, evaluationError }: OpportunityDiscoveryProps) {
  const [state, formAction, pending] = useActionState(async (previous: DiscoveryState, formData: FormData): Promise<DiscoveryState> => {
    let result: SearchState;
    try {
      result = await searchOpportunities(null, formData);
    } catch {
      return { ...previous, error: "Could not load advertisements. Your displayed results are unchanged. Please try again." };
    }
    if (result.status === "error") return { ...previous, error: result.message };
    const earlier = previous.result;
    if (result.offset === 0 || !earlier || JSON.stringify(result.criteria) !== JSON.stringify(earlier.criteria)) {
      return { result, error: null };
    }
    // Keep existing cards mounted, including any evaluation just run in the browser.
    const seen = new Set(earlier.opportunities.map((opportunity) => opportunity.id));
    const additions = result.opportunities.filter((opportunity) => {
      if (seen.has(opportunity.id)) return false;
      seen.add(opportunity.id);
      return true;
    });
    return { error: null, result: {
      ...result, opportunities: [...earlier.opportunities, ...additions],
      skippedCount: earlier.skippedCount + result.skippedCount,
      evaluations: { ...earlier.evaluations, ...result.evaluations },
      evaluationError: result.evaluationError ?? earlier.evaluationError,
    } };
  }, initialState);
  const [query, setQuery] = useState("");
  const [dirtyDrafts, setDirtyDrafts] = useState<Set<number>>(() => new Set());
  const onDraftDirtyChange = useCallback((id: number, dirty: boolean) => {
    setDirtyDrafts((current) => {
      if (current.has(id) === dirty) return current;
      const next = new Set(current);
      if (dirty) next.add(id); else next.delete(id);
      return next;
    });
  }, []);
  const result = state.result;
  const opportunities = result ? result.opportunities : savedOpportunities;
  const evaluations = result ? result.evaluations ?? {} : savedEvaluations;
  const evaluationsError = result ? result.evaluationError : evaluationError;

  return (
    <section aria-labelledby="search-heading" className="card">
      <p className="eyebrow">Platsbanken</p>
      <h2 id="search-heading">Find opportunities</h2>
      {/* Keep the search criteria when React resets a completed action form. */}
      <form action={formAction} onReset={(event) => event.preventDefault()}>
        <fieldset className="search-fields" disabled={pending || dirtyDrafts.size > 0}>
          <div className="field">
            <label htmlFor="query">Search term</label>
            <input id="query" name="query" type="search" placeholder="For example, developer or support"
              value={query} onChange={(event) => setQuery(event.target.value)} required />
          </div>
          <LocationPicker municipalities={municipalities} />
          <button type="submit">Search Platsbanken</button>
        </fieldset>
        <p className="muted">
          {municipalities.length === 0
            ? "The location list is unavailable. You can still search all of Sweden. Refresh to try loading locations again."
            : "Load 20 advertisements at a time. Results are saved on this computer."}
        </p>
      </form>
      {dirtyDrafts.size > 0 && <p className="muted">Save or reopen unsaved application drafts below before starting a new search.</p>}

      <div aria-live="polite" aria-atomic="true">
        {pending && <p className="status">Loading advertisements and saving results…</p>}
        {state.error && <p className="error-message" role="alert">{state.error}</p>}
        {result && !pending && (
          <p className="status">
            Showing {result.opportunities.length} saved results from {result.total} matches for “{result.criteria.query}”.
            {result.skippedCount > 0 && ` Skipped ${result.skippedCount} advertisements with invalid data.`}
          </p>
        )}
      </div>

      <div className="search-results" aria-busy={pending}>
        <h3>{result ? "Search results" : "Recently saved"}</h3>
        {!result && savedError && <p className="error-message">{savedError}</p>}
        <OpportunityList opportunities={opportunities} evaluations={evaluations} evaluationError={evaluationsError} onDraftDirtyChange={onDraftDirtyChange} emptyMessage={result
          ? result.total === 0 ? "No matching advertisements. Try another search term or location."
            : "No usable advertisements loaded so far. Load more or try another search."
          : "No saved opportunities yet. Run a search to get started."} />
        {result && result.nextOffset !== null && <form action={formAction}>
          <input type="hidden" name="query" value={result.criteria.query} />
          {result.criteria.municipalities.map((id) => <input key={id} type="hidden" name="municipality" value={id} />)}
          <input type="hidden" name="offset" value={result.nextOffset} />
          <button type="submit" disabled={pending}>{pending ? "Loading…" : "Load more"}</button>
        </form>}
        {result?.limitReached && <p className="muted">Platsbanken’s browsing limit for this search has been reached. Use a more specific search term or location to explore more matches.</p>}
        {result && result.nextOffset === null && !result.limitReached && result.opportunities.length > 0
          && <p className="muted">No more advertisements available for this search.</p>}
      </div>
    </section>
  );
}
