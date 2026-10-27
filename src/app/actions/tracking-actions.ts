"use server";

import { openDatabase } from "../../lib/db.ts";
import { getOpportunity } from "../../lib/opportunities.ts";
import { getEvaluations } from "../../lib/opportunity-evaluations.ts";
import { getTrackingDetails, listTrackedOpportunities, saveTracking, TrackingConflictError } from "../../lib/opportunity-tracking.ts";
import { trackingFilterSchema, trackingIdSchema, trackingInputSchema, trackingOffsetSchema, trackingRevisionSchema,
  type TrackingFilter, type TrackingInput, type TrackingPageState, type TrackingState } from "../../schemas/opportunity-tracking.ts";

export async function openTracking(opportunityId: number): Promise<TrackingState> {
  if (!trackingIdSchema.safeParse(opportunityId).success) return { status: "error", message: "Choose a saved opportunity." };
  try {
    const db = openDatabase();
    try {
      if (!getOpportunity(db, opportunityId)) return { status: "error", message: "This saved opportunity could not be found." };
      return { status: "success", details: getTrackingDetails(db, opportunityId) };
    } finally { db.close(); }
  } catch { return { status: "error", message: "Tracking could not be opened. Run npm run db:migrate if needed, then try again." }; }
}

export async function saveOpportunityTracking(opportunityId: number, input: TrackingInput, expectedRevision: number): Promise<TrackingState> {
  if (!trackingIdSchema.safeParse(opportunityId).success || !trackingInputSchema.safeParse(input).success
      || !trackingRevisionSchema.safeParse(expectedRevision).success) {
    return { status: "error", message: "Choose a valid status and application date, with notes of up to 6,000 characters." };
  }
  try {
    const db = openDatabase();
    try { return { status: "success", details: saveTracking(db, opportunityId, input, expectedRevision) }; }
    finally { db.close(); }
  } catch (error) {
    return { status: "error", message: error instanceof TrackingConflictError
      ? "Tracking changed elsewhere. Your editor is unchanged. Copy any notes before reopening the saved version."
      : "Tracking could not be saved. Your editor is unchanged. Check the database setup and try again." };
  }
}

export async function loadTrackedOpportunities(filter: TrackingFilter = "tracked", offset = 0): Promise<TrackingPageState> {
  if (!trackingFilterSchema.safeParse(filter).success || !trackingOffsetSchema.safeParse(offset).success) {
    return { status: "error", message: "Choose a valid tracking filter and page." };
  }
  try {
    const db = openDatabase();
    try {
      const page = listTrackedOpportunities(db, filter, offset);
      try {
        return { status: "success", page: { ...page, evaluations: getEvaluations(db, page.items.map((item) => item.opportunity.id)) } };
      } catch {
        return { status: "success", page: { ...page, evaluations: {}, evaluationError: "Saved evaluations could not be loaded. Tracking remains available." } };
      }
    } finally { db.close(); }
  } catch { return { status: "error", message: "The tracking list could not be loaded. Run npm run db:migrate if needed, then try again." }; }
}
