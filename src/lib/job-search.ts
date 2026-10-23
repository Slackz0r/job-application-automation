import "server-only";

import { opportunityInputSchema, type OpportunityInput } from "../schemas/opportunity.ts";
import {
  searchInputSchema,
  maxSearchOffset,
  jobSearchResponseSchema,
  jobSearchAdvertisementSchema,
  municipalitiesResponseSchema,
  type JobSearchInput,
  type JobSearchResult,
  type Municipality,
} from "../schemas/job-search.ts";

export async function getMunicipalities(fetcher: typeof fetch = fetch): Promise<Municipality[]> {
  const response = await fetcher(
    "https://taxonomy.api.jobtechdev.se/v1/taxonomy/specific/concepts/municipality?limit=1000",
    { headers: { Accept: "application/json" }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error("The municipality list could not be loaded.");

  const municipalities = municipalitiesResponseSchema.parse(await response.json());

  return municipalities.map((municipality) => ({
    id: municipality["taxonomy/id"],
    name: municipality["taxonomy/preferred-label"],
  })).sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

export async function searchJobs(
  input: JobSearchInput,
  fetcher: typeof fetch = fetch,
): Promise<JobSearchResult> {
  const search = searchInputSchema.parse(input);
  const url = new URL("https://jobsearch.api.jobtechdev.se/search");
  url.searchParams.set("q", search.query);
  url.searchParams.set("limit", String(search.limit));
  url.searchParams.set("offset", String(search.offset));
  for (const municipality of search.municipalities) {
    url.searchParams.append("municipality", municipality);
  }

  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new Error("Could not reach Platsbanken. Please try again.", { cause: error });
  }
  if (!response.ok) {
    throw new Error(`Platsbanken search failed (HTTP ${response.status}).`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Platsbanken returned an unreadable search response.", { cause: error });
  }
  const result = jobSearchResponseSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("Platsbanken returned an unexpected search response.");
  }

  const opportunities: OpportunityInput[] = [];
  let skippedCount = 0;
  for (const hit of result.data.hits) {
    const advertisement = jobSearchAdvertisementSchema.safeParse(hit);
    if (!advertisement.success) {
      skippedCount++;
      continue;
    }
    const ad = advertisement.data;
    const locationNames = [...(ad.workplace_addresses ?? []), ad.workplace_address]
      .map((address) => address?.municipality?.trim() || address?.city?.trim()
        || address?.region?.trim() || address?.country?.trim())
      .filter(Boolean);
    const opportunity = opportunityInputSchema.safeParse({
      source: "platsbanken",
      sourceId: ad.id,
      title: ad.headline,
      company: ad.employer?.name,
      location: [...new Set(locationNames)].join(", ") || null,
      description: ad.description?.text,
      url: ad.webpage_url,
      applicationDeadline: ad.application_deadline,
      publishedAt: ad.publication_date,
    });
    if (opportunity.success) {
      opportunities.push(opportunity.data);
    } else {
      skippedCount++;
    }
  }

  // Advance by source hits, including invalid ads, rather than displayed results.
  const next = search.offset + result.data.hits.length;
  const more = result.data.hits.length > 0 && next < result.data.total.value;
  return {
    total: result.data.total.value, opportunities, skippedCount,
    nextOffset: more && next <= maxSearchOffset ? next : null,
    limitReached: more && next > maxSearchOffset,
  };
}
