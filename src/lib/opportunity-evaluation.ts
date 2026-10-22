import "server-only";

import { z } from "zod";
import type { Opportunity } from "../schemas/opportunity.ts";
import type { ProfessionalProfile } from "../schemas/professional-profile.ts";
import { comparisonModel, evaluationModel, evaluationResultSchema, liveEvaluationResultSchema, type ComparisonState, type LiveEvaluationState, type SavedEvaluation } from "../schemas/opportunity-evaluation.ts";
import { openDatabase } from "./db.ts";
import { getOpportunity } from "./opportunities.ts";
import { getEvaluation, saveEvaluation } from "./opportunity-evaluations.ts";
import { loadProfessionalProfile } from "./professional-profile.ts";

// Both simulation and live requests use this approved input boundary.
export function createEvaluationInput(opportunity: Opportunity, profile: ProfessionalProfile) {
  if (!opportunity.description?.trim()) {
    throw new Error("Advertisement text is required for evaluation.");
  }

  return {
    opportunity: {
      title: opportunity.title,
      company: opportunity.company,
      location: opportunity.location,
      description: opportunity.description,
    },
    profile: {
      skillsAndCompetencies: profile.skillsAndCompetencies,
      experiences: {
        professional: profile.experiences.professional,
        education: profile.experiences.education,
      },
      careerPreferences: profile.careerPreferences,
    },
  };
}

export type EvaluationInput = ReturnType<typeof createEvaluationInput>;

export type EvaluationState =
  | { status: "success"; evaluation: SavedEvaluation }
  | { status: "error"; message: string; requestId?: string };

// The action supplies the browser-bound subscription call. Tests supply a fake.
export async function evaluateSavedOpportunity(
  opportunityId: number,
  formData: FormData,
  runEvaluation: (input: EvaluationInput) => Promise<LiveEvaluationState>,
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
      if (existing?.mode === "live" && formData.get("reevaluate") !== "true") {
        return { status: "success", evaluation: existing };
      }
      if (!opportunity.description?.trim()) {
        return { status: "error", message: "This opportunity needs advertisement text before it can be evaluated." };
      }
      const profile = await loadProfessionalProfile();
      if (profile.status !== "ready") {
        return { status: "error", message: "The professional profile needs attention. Check the profile setup message below." };
      }
      const response = await runEvaluation(createEvaluationInput(opportunity, profile.profile));
      if (response.status === "error") {
        return { ...response, message: `${response.message} Any previous saved result is unchanged.` };
      }
      try {
        const evaluation = saveEvaluation(db, opportunityId, response.result, { mode: "live", model: response.model });
        return { status: "success", evaluation };
      } catch {
        return { status: "error", message: "The AI request completed, but its result could not be saved. Any previous saved result is unchanged. Trying again will make a new subscription request." };
      }
    } finally { db.close(); }
  } catch {
    return { status: "error", message: "The evaluation could not be prepared. Run npm run db:migrate if needed, then try again. Any previous saved result is unchanged." };
  }
}

// A comparison returns display data only. It never writes an evaluation to SQLite.
export async function compareSavedOpportunity(
  opportunityId: number,
  runComparison: (input: EvaluationInput) => Promise<LiveEvaluationState>,
): Promise<ComparisonState> {
  if (!z.number().int().positive().max(Number.MAX_SAFE_INTEGER).safeParse(opportunityId).success) {
    return { status: "error", message: "Choose a saved opportunity to compare." };
  }
  try {
    const db = openDatabase();
    try {
      const opportunity = getOpportunity(db, opportunityId);
      if (!opportunity?.description?.trim()) {
        return { status: "error", message: "A saved advertisement with text is required for comparison." };
      }
      const baseline = getEvaluation(db, opportunityId);
      if (baseline?.mode !== "live" || baseline.model !== evaluationModel) {
        return { status: "error", message: "Save a GPT-6.1 Sol evaluation before comparing it with Luna." };
      }
      const profile = await loadProfessionalProfile();
      if (profile.status !== "ready") {
        return { status: "error", message: "The professional profile needs attention before comparison." };
      }
      const started = performance.now();
      const response = await runComparison(createEvaluationInput(opportunity, profile.profile));
      if (response.status === "error") return response;
      if (response.model !== comparisonModel) {
        return { status: "error", message: "The comparison did not use the agreed Luna model. The saved Sol result is unchanged." };
      }
      const result = liveEvaluationResultSchema.parse(response.result);
      const current = getEvaluation(db, opportunityId);
      if (current?.mode !== "live" || current.model !== evaluationModel || current.evaluatedAt !== baseline.evaluatedAt) {
        return { status: "error", message: "The saved Sol result changed during this comparison. No result was replaced; refresh before comparing again." };
      }
      return { status: "success", comparison: {
        model: comparisonModel, result, baselineEvaluatedAt: baseline.evaluatedAt,
        comparedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started),
      } };
    } finally { db.close(); }
  } catch {
    return { status: "error", message: "The comparison could not be completed. The saved Sol result is unchanged. No automatic retry was made." };
  }
}

export function simulateOpportunityEvaluation(opportunity: Opportunity, profile: ProfessionalProfile) {
  const input = createEvaluationInput(opportunity, profile);

  // Deliberately illustrative: no keyword matching, suitability judgement, or API call.
  return evaluationResultSchema.parse({
    recommendation: "needs_clarification",
    summary: `Sample result for “${input.opportunity.title}”. This simulation checks the evaluation workflow; it does not assess your suitability.`,
    supportingEvidence: [
      "Example only: a real evaluation would connect the advertisement's requirements to documented contributions in your profile.",
    ],
    gapsAndUnknowns: [
      "No assessment of the advertisement or your qualifications has been made.",
      "In a real evaluation, information missing from your profile must remain unknown, rather than count as missing experience.",
    ],
  });
}
