import { z } from "zod";
import { evaluationModel } from "./opportunity-evaluation.ts";

export const draftQuestionSchema = z.string().trim().min(1).max(3000);
export const draftTextSchema = z.string().trim().min(1).max(12000);
export const draftRevisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1);
export const draftIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const draftContentSchema = z.strictObject({
  question: draftQuestionSchema,
  text: draftTextSchema,
  model: z.literal(evaluationModel).nullable(),
});
export const generatedDraftSchema = z.strictObject({ text: draftTextSchema });
export const savedDraftSchema = draftContentSchema.extend({
  opportunityId: draftIdSchema,
  revision: draftRevisionSchema.refine((revision) => revision > 0),
  savedAt: z.iso.datetime(),
});

export type DraftContent = z.infer<typeof draftContentSchema>;
export type SavedDraft = z.infer<typeof savedDraftSchema>;
export type DraftState =
  | { status: "success"; draft: SavedDraft | null }
  | { status: "error"; message: string };
export type GeneratedDraftState =
  | { status: "success"; draft: DraftContent }
  | { status: "error"; message: string; requestId?: string };
