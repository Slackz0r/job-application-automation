"use client";

import { useActionState, useState } from "react";
import type { Municipality } from "@/schemas/job-search";
import type { Opportunity } from "@/schemas/opportunity";
import type { EvaluationMap } from "@/schemas/opportunity-evaluation";
import { searchOpportunities } from "@/app/actions/opportunity-actions";
import { LocationPicker } from "./location-picker";
import { OpportunityList } from "./opportunity-list";

type OpportunityDiscoveryProps = {
  municipalities: Municipality[];
  savedOpportunities: Opportunity[];
  savedError: string | null;
  savedEvaluations: EvaluationMap;
  evaluationError: string | null;
};

export function OpportunityDiscovery({ municipalities, savedOpportunities, savedError, savedEvaluations, evaluationError }: OpportunityDiscoveryProps) {
  const [state, formAction, pending] = useActionState(searchOpportunities, null);
  const [query, setQuery] = useState("");
  const opportunities = state?.status === "success" ? state.opportunities : savedOpportunities;
  const evaluations = state?.status === "success" ? state.evaluations ?? {} : savedEvaluations;
  const evaluationsError = state?.status === "success" ? state.evaluationError : evaluationError;

  return (
    <section aria-labelledby="search-heading" className="card">
      <p className="eyebrow">Platsbanken</p>
      <h2 id="search-heading">Find opportunities</h2>
      {/* Keep the search criteria when React resets a completed action form. */}
      <form action={formAction} onReset={(event) => event.preventDefault()}>
        <fieldset className="search-fields" disabled={pending}>
          <div className="field">
            <label htmlFor="query">Search term</label>
            <input id="query" name="query" type="search" placeholder="For example, developer or support"
              value={query} onChange={(event) => setQuery(event.target.value)} required />
          </div>
          <LocationPicker municipalities={municipalities} />
          <button type="submit">{pending ? "Searching…" : "Search Platsbanken"}</button>
        </fieldset>
        <p className="muted">
          {municipalities.length === 0
            ? "The location list is unavailable. You can still search all of Sweden. Refresh to try loading locations again."
            : "Searches show up to 20 advertisements. Results are saved on this computer."}
        </p>
      </form>

      <div aria-live="polite" aria-atomic="true">
        {pending && <p className="status">Searching Platsbanken and saving results…</p>}
        {state?.status === "error" && <p className="error-message" role="alert">{state.message}</p>}
        {state?.status === "success" && !pending && (
          <p className="status">
            Showing {state.opportunities.length} saved results from {state.total} matches.
            {state.skippedCount > 0 && ` Skipped ${state.skippedCount} advertisements with invalid data.`}
          </p>
        )}
      </div>

      <div className="search-results" aria-busy={pending}>
        <h3>{state?.status === "success" ? "Search results" : "Recently saved"}</h3>
        {state?.status !== "success" && savedError && <p className="error-message">{savedError}</p>}
        <OpportunityList opportunities={opportunities} evaluations={evaluations} evaluationError={evaluationsError} emptyMessage={state?.status === "success"
          ? state.total === 0 ? "No matching advertisements. Try another search term or location."
            : "None of the returned advertisements contained usable data. Try another search."
          : "No saved opportunities yet. Run a search to get started."} />
      </div>
    </section>
  );
}
