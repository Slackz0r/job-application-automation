import { z } from "zod";

const requiredText = z.string().trim().min(1);
const optionalText = z.string().trim().nullish().transform((value) => value || null);
const optionalDate = z.union([
  z.iso.date(),
  z.iso.datetime({ offset: true, local: true }),
]).nullish().transform((value) => value ?? null);

export const opportunityInputSchema = z.object({
  source: requiredText,
  sourceId: requiredText,
  title: requiredText,
  company: optionalText,
  location: optionalText,
  description: optionalText,
  url: requiredText.pipe(z.httpUrl()),
  applicationDeadline: optionalDate,
  publishedAt: optionalDate,
});

export type OpportunityInput = z.input<typeof opportunityInputSchema>;
export type Opportunity = z.output<typeof opportunityInputSchema> & {
  id: number;
  discoveredAt: string;
};
