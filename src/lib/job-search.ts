import "server-only";

import { z } from "zod";
import { opportunityInputSchema, type OpportunityInput } from "./opportunities.ts";

const searchInputSchema = z.object({
  query: z.string().trim().min(1),
  municipalities: z.array(z.string().trim().min(1)).default([])
    .transform((values) => [...new Set(values)]),
  limit: z.number().int().min(1).max(100).default(20),
});

const searchResponseSchema = z.object({
  total: z.object({ value: z.number().int().nonnegative() }),
  hits: z.array(z.unknown()),
});

const workplaceAddressSchema = z.object({
  municipality: z.string().nullish(),
  city: z.string().nullish(),
  region: z.string().nullish(),
  country: z.string().nullish(),
}).nullish().catch(null);

// Read only the fields we use; source advertisements can contain other data.
const advertisementSchema = z.object({
  id: z.string(),
  headline: z.string(),
  webpage_url: z.string(),
  employer: z.object({ name: z.string().nullish() }).nullish(),
  description: z.object({ text: z.string().nullish() }).nullish(),
  application_deadline: z.string().nullish(),
  publication_date: z.string().nullish(),
  workplace_address: workplaceAddressSchema,
  workplace_addresses: z.array(workplaceAddressSchema).nullish().catch(null),
});

export type JobSearchInput = z.input<typeof searchInputSchema>;
export type JobSearchResult = {
  total: number;
  opportunities: OpportunityInput[];
  skippedCount: number;
};

export type Municipality = { id: string; name: string };

export async function getMunicipalities(fetcher: typeof fetch = fetch): Promise<Municipality[]> {
  const response = await fetcher(
    "https://taxonomy.api.jobtechdev.se/v1/taxonomy/specific/concepts/municipality?limit=1000",
    { headers: { Accept: "application/json" }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error("The municipality list could not be loaded.");

  const municipalities = z.array(z.object({
    "taxonomy/id": z.string().trim().min(1),
    "taxonomy/preferred-label": z.string().trim().min(1),
  })).min(1).parse(await response.json());

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
  const result = searchResponseSchema.safeParse(payload);
  if (!result.success) {
    throw new Error("Platsbanken returned an unexpected search response.");
  }

  const opportunities: OpportunityInput[] = [];
  let skippedCount = 0;
  for (const hit of result.data.hits) {
    const advertisement = advertisementSchema.safeParse(hit);
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

  return { total: result.data.total.value, opportunities, skippedCount };
}
