"use client";

import { useState } from "react";
import type { Municipality } from "@/schemas/job-search";

type LocationPickerProps = {
  municipalities: Municipality[];
};

export function LocationPicker({ municipalities }: LocationPickerProps) {
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState("");

  const matchingLocations = municipalities.filter((location) => location.name.toLocaleLowerCase("sv")
    .includes(locationFilter.trim().toLocaleLowerCase("sv")));

  return (
    <fieldset className="field location-field" aria-describedby="location-help">
      <legend>Location (optional)</legend>

      {/* Submit every selected location, including those hidden by the filter. */}
      {selectedLocations.map((id) => (
        <input key={id} type="hidden" name="municipality" value={id} />
      ))}

      <details className="location-picker">
        <summary>
          {selectedLocations.length > 0
            ? `${selectedLocations.length} ${selectedLocations.length === 1 ? "location" : "locations"} selected`
            : "All of Sweden"}
        </summary>

        <div className="location-picker-content">
          <label htmlFor="location-filter">Find a location</label>
          <input
            id="location-filter"
            type="search"
            placeholder="Search locations"
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />

          <div className="location-options">
            {matchingLocations.map((location) => (
              <label key={location.id} className="location-option">
                <input
                  type="checkbox"
                  checked={selectedLocations.includes(location.id)}
                  onChange={(event) => setSelectedLocations((current) => event.target.checked
                    ? [...current, location.id]
                    : current.filter((id) => id !== location.id))}
                />
                {location.name}
              </label>
            ))}

            {matchingLocations.length === 0 && <p className="muted">No locations found.</p>}
          </div>
        </div>
      </details>

      {selectedLocations.length > 0 && (
        <div className="selected-locations" aria-label="Selected locations">
          {municipalities.filter((location) => selectedLocations.includes(location.id)).map((location) => (
            <button
              key={location.id}
              type="button"
              className="location-chip"
              aria-label={`Remove ${location.name}`}
              onClick={() => setSelectedLocations((current) => current.filter((id) => id !== location.id))}
            >
              {location.name} <span aria-hidden="true">×</span>
            </button>
          ))}

          <button type="button" className="location-clear" onClick={() => setSelectedLocations([])}>
            Clear locations
          </button>
        </div>
      )}

      <p id="location-help" className="muted">
        Choose one or more locations. Leave empty to search all of Sweden.
      </p>
    </fieldset>
  );
}
