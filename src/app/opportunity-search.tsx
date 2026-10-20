"use client";

import { useActionState, useState } from "react";
import type { Municipality } from "../lib/job-search";
import type { Opportunity } from "../lib/opportunities";
import { searchOpportunities } from "./actions";

type OpportunitySearchProps = {
  municipalities: Municipality[];
  savedOpportunities: Opportunity[];
  savedError: string | null;
};

export function OpportunitySearch({ municipalities, savedOpportunities, savedError }: OpportunitySearchProps) {
  const [state, formAction, pending] = useActionState(searchOpportunities, null);
  const [query, setQuery] = useState("");
  const [municipality, setMunicipality] = useState("");
  const opportunities = state?.status === "success" ? state.opportunities : savedOpportunities;

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
          <div className="field">
            <label htmlFor="municipality">Municipality (optional)</label>
            <select id="municipality" name="municipality" value={municipality}
              onChange={(event) => setMunicipality(event.target.value)} aria-describedby="location-help">
              <option value="">All of Sweden</option>
              {municipalities.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </div>
          <button type="submit">{pending ? "Searching…" : "Search Platsbanken"}</button>
        </fieldset>
        <p id="location-help" className="muted">
          {municipalities.length === 0
            ? "The municipality list is unavailable. You can still search all of Sweden. Refresh to try loading locations again."
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
        {opportunities.length === 0 ? (
          <p className="muted">{state?.status === "success"
            ? state.total === 0 ? "No matching advertisements. Try another search term or municipality."
              : "None of the returned advertisements contained usable data. Try another search."
            : "No saved opportunities yet. Run a search to get started."}</p>
        ) : (
          <ul className="opportunity-list">
            {opportunities.map((opportunity) => (
              <li key={opportunity.id} className="opportunity">
                <h4>{opportunity.title}</h4>
                <p className="company">{opportunity.company || "Company not provided"}</p>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
