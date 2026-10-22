import "server-only";

import type { Opportunity } from "../schemas/opportunity.ts";
import type { ProfessionalProfile } from "../schemas/professional-profile.ts";
import { evaluationResultSchema } from "../schemas/opportunity-evaluation.ts";

// This is the intended input boundary for a future provider call. Nothing is sent.
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
