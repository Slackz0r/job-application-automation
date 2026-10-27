import { z } from "zod";
import type { Opportunity } from "./opportunity.ts";
import type { EvaluationMap } from "./opportunity-evaluation.ts";

export const trackingStatusSchema = z.enum(["to_review", "interested", "applied", "interview", "offer", "closed", "skipped"]);
export const trackingLabels = {
  to_review: "To review", interested: "Interested", applied: "Applied", interview: "Interview",
  offer: "Offer", closed: "Closed", skipped: "Skipped",
} as const;
export const trackingInputSchema = z.strictObject({
  status: trackingStatusSchema,
  appliedOn: z.iso.date().nullable(),
  notes: z.string().trim().max(6000),
});
export const trackingIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const trackingRevisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1);
export const trackingSchema = trackingInputSchema.extend({
  opportunityId: trackingIdSchema, revision: trackingRevisionSchema, updatedAt: z.iso.datetime().nullable(),
});
export const statusHistorySchema = z.strictObject({
  id: trackingIdSchema, fromStatus: trackingStatusSchema, toStatus: trackingStatusSchema,
  changedAt: z.iso.datetime(), revision: trackingRevisionSchema,
});
export const trackingFilterSchema = z.enum(["tracked", ...trackingStatusSchema.options]);
export const trackingPageSize = 20;
export const trackingOffsetSchema = z.number().int().nonnegative().max(1_000_000);

export type TrackingStatus = z.infer<typeof trackingStatusSchema>;
export type TrackingFilter = z.infer<typeof trackingFilterSchema>;
export type TrackingInput = z.infer<typeof trackingInputSchema>;
export type Tracking = z.infer<typeof trackingSchema>;
export type TrackingMap = Record<number, Tracking>;
export type StatusHistory = z.infer<typeof statusHistorySchema>;
export type TrackingDetails = { tracking: Tracking; history: StatusHistory[]; historyCount: number };
export type TrackingState = { status: "success"; details: TrackingDetails } | { status: "error"; message: string };
export type TrackingPage = {
  items: { opportunity: Opportunity; tracking: Tracking }[];
  filter: TrackingFilter; offset: number; nextOffset: number | null; total: number;
  evaluations: EvaluationMap; evaluationError?: string;
};
export type TrackingPageState = { status: "success"; page: TrackingPage } | { status: "error"; message: string };
