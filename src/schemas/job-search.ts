import { z } from "zod";
import type { OpportunityInput } from "./opportunity.ts";

// Search criteria accepted by our application.
export const searchInputSchema = z.object({
  query: z.string().trim().min(1),
  municipalities: z.array(z.string().trim().min(1)).default([])
    .transform((values) => [...new Set(values)]),
  limit: z.number().int().min(1).max(100).default(20),
});

// JobTech API responses, before conversion to our application format.
export const jobSearchResponseSchema = z.object({
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
export const jobSearchAdvertisementSchema = z.object({
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

export const municipalitiesResponseSchema = z.array(z.object({
  "taxonomy/id": z.string().trim().min(1),
  "taxonomy/preferred-label": z.string().trim().min(1),
})).min(1);

export type JobSearchInput = z.input<typeof searchInputSchema>;
export type JobSearchResult = {
  total: number;
  opportunities: OpportunityInput[];
  skippedCount: number;
};

export type Municipality = { id: string; name: string };
