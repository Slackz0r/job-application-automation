import { z } from "zod";

const text = z.string().trim().min(1);

export const evaluationResultSchema = z.strictObject({
  recommendation: z.enum(["worth_considering", "needs_clarification", "unlikely_fit"]),
  summary: text,
  supportingEvidence: z.array(text),
  gapsAndUnknowns: z.array(text),
});

export const savedEvaluationSchema = z.strictObject({
  opportunityId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  mode: z.literal("simulated"),
  result: evaluationResultSchema,
  evaluatedAt: z.iso.datetime(),
});

export const recommendationLabels = {
  worth_considering: "Worth considering",
  needs_clarification: "Needs clarification",
  unlikely_fit: "Unlikely fit",
} as const;

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
export type SavedEvaluation = z.infer<typeof savedEvaluationSchema>;
export type EvaluationMap = Record<number, SavedEvaluation>;
