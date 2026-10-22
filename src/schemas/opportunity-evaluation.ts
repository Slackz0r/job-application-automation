import { z } from "zod";

const text = z.string().trim().min(1);

export const evaluationResultSchema = z.strictObject({
  recommendation: z.enum(["worth_considering", "needs_clarification", "unlikely_fit"]),
  summary: text,
  supportingEvidence: z.array(text),
  gapsAndUnknowns: z.array(text),
});

const savedFields = {
  opportunityId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  result: evaluationResultSchema,
  evaluatedAt: z.iso.datetime(),
};

export const savedEvaluationSchema = z.discriminatedUnion("mode", [
  z.strictObject({ ...savedFields, mode: z.literal("simulated"), model: z.null() }),
  z.strictObject({ ...savedFields, mode: z.literal("live"), model: text.max(200) }),
]);

export const evaluationModel = "gpt-6.1-sol";
export const comparisonModel = "gpt-6-luna";
export const evaluationModelSchema = z.enum([evaluationModel, comparisonModel]);
export type EvaluationModel = z.infer<typeof evaluationModelSchema>;

// Bound the live reply while retaining the agreed four-field result format.
export const liveEvaluationResultSchema = evaluationResultSchema.extend({
  summary: text.max(1800),
  supportingEvidence: z.array(text.max(1200)).max(8),
  gapsAndUnknowns: z.array(text.max(1200)).max(8),
});

export type LiveEvaluationState =
  | { status: "success"; model: string; result: EvaluationResult }
  | { status: "error"; message: string; requestId?: string };

export type ComparisonState =
  | { status: "success"; comparison: {
    model: typeof comparisonModel;
    result: EvaluationResult;
    baselineEvaluatedAt: string;
    comparedAt: string;
    elapsedMs: number;
  } }
  | { status: "error"; message: string; requestId?: string };

export const recommendationLabels = {
  worth_considering: "Worth considering",
  needs_clarification: "Needs clarification",
  unlikely_fit: "Unlikely fit",
} as const;

export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
export type SavedEvaluation = z.infer<typeof savedEvaluationSchema>;
export type EvaluationMap = Record<number, SavedEvaluation>;
