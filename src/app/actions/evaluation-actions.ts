"use server";

import { z } from "zod";
import { openDatabase } from "../../lib/db.ts";
import { getOpportunity } from "../../lib/opportunities.ts";
import { loadProfessionalProfile } from "../../lib/professional-profile.ts";
import { simulateOpportunityEvaluation } from "../../lib/opportunity-evaluation.ts";
import { getEvaluation, saveEvaluation } from "../../lib/opportunity-evaluations.ts";
import type { SavedEvaluation } from "../../schemas/opportunity-evaluation.ts";

export type EvaluationState =
  | { status: "success"; evaluation: SavedEvaluation }
  | { status: "error"; message: string };

export async function evaluateOpportunity(
  opportunityId: number,
  _previousState: EvaluationState | null,
  formData: FormData,
): Promise<EvaluationState> {
  if (!z.number().int().positive().max(Number.MAX_SAFE_INTEGER).safeParse(opportunityId).success) {
    return { status: "error", message: "Choose a saved opportunity to evaluate." };
  }

  try {
    const db = openDatabase();
    try {
      const opportunity = getOpportunity(db, opportunityId);
      if (!opportunity) return { status: "error", message: "This saved opportunity could not be found." };

      const existing = getEvaluation(db, opportunityId);
      if (existing && formData.get("reevaluate") !== "true") {
        return { status: "success", evaluation: existing };
      }
      if (!opportunity.description?.trim()) {
        return { status: "error", message: "This opportunity needs advertisement text before it can be evaluated." };
      }
      const profile = await loadProfessionalProfile();
      if (profile.status !== "ready") {
        return { status: "error", message: "The professional profile needs attention. Check the profile setup message below." };
      }

      const result = simulateOpportunityEvaluation(opportunity, profile.profile);
      return { status: "success", evaluation: saveEvaluation(db, opportunityId, result) };
    } finally {
      db.close();
    }
  } catch {
    return {
      status: "error",
      message: "The simulated evaluation could not be completed or saved. Run npm run db:migrate if needed, then try again. Any previous saved result is unchanged.",
    };
  }
}
