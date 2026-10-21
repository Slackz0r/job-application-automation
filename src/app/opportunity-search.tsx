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
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState("");
  const matchingLocations = municipalities.filter((location) => location.name.toLocaleLowerCase("sv")
    .includes(locationFilter.trim().toLocaleLowerCase("sv")));
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
          <fieldset className="field location-field" aria-describedby="location-help">
            <legend>Location (optional)</legend>
            {/* Submit every selected location, including those hidden by the filter. */}
            {selectedLocations.map((id) => <input key={id} type="hidden" name="municipality" value={id} />)}
            <details className="location-picker">
              <summary>{selectedLocations.length > 0
                ? `${selectedLocations.length} ${selectedLocations.length === 1 ? "location" : "locations"} selected`
                : "All of Sweden"}</summary>
              <div className="location-picker-content">
                <label htmlFor="location-filter">Find a location</label>
                <input id="location-filter" type="search" placeholder="Search locations"
                  value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
                <div className="location-options">
                  {matchingLocations.map((location) => (
                    <label key={location.id} className="location-option">
                      <input type="checkbox" checked={selectedLocations.includes(location.id)}
                        onChange={(event) => setSelectedLocations((current) => event.target.checked
                          ? [...current, location.id] : current.filter((id) => id !== location.id))} />
                      {location.name}
                    </label>
                  ))}
                  {matchingLocations.length === 0 && <p className="muted">No locations found.</p>}
                </div>
              </div>
            </details>
            {selectedLocations.length > 0 && <div className="selected-locations" aria-label="Selected locations">
              {municipalities.filter((location) => selectedLocations.includes(location.id)).map((location) => (
                <button key={location.id} type="button" className="location-chip" aria-label={`Remove ${location.name}`}
                  onClick={() => setSelectedLocations((current) => current.filter((id) => id !== location.id))}>
                  {location.name} <span aria-hidden="true">×</span>
                </button>
              ))}
              <button type="button" className="location-clear" onClick={() => setSelectedLocations([])}>Clear locations</button>
            </div>}
            <p id="location-help" className="muted">Choose one or more locations. Leave empty to search all of Sweden.</p>
          </fieldset>
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
        {opportunities.length === 0 ? (
          <p className="muted">{state?.status === "success"
            ? state.total === 0 ? "No matching advertisements. Try another search term or location."
              : "None of the returned advertisements contained usable data. Try another search."
            : "No saved opportunities yet. Run a search to get started."}</p>
        ) : (
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
