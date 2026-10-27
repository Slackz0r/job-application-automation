import "server-only";

import { openDatabase } from "./db.ts";
import { getOpportunity } from "./opportunities.ts";
import { loadProfessionalProfile } from "./professional-profile.ts";
import { createEvaluationInput, type EvaluationInput } from "./opportunity-evaluation.ts";
import { DraftConflictError, getDraft, saveDraft } from "./application-drafts.ts";
import { draftContentSchema, draftIdSchema, draftQuestionSchema, draftRevisionSchema, type DraftState, type GeneratedDraftState } from "../schemas/application-draft.ts";

export type ApplicationInput = EvaluationInput & { question: string };

export function loadApplicationDraft(opportunityId: number): DraftState {
  if (!draftIdSchema.safeParse(opportunityId).success) return { status: "error", message: "Choose a saved opportunity." };
  try {
    const db = openDatabase();
    try {
      if (!getOpportunity(db, opportunityId)) return { status: "error", message: "This saved opportunity could not be found." };
      return { status: "success", draft: getDraft(db, opportunityId) };
    } finally { db.close(); }
  } catch {
    return { status: "error", message: "The draft could not be opened. Run npm run db:migrate if needed, then try again." };
  }
}

export async function generateForOpportunity(
  opportunityId: number, question: unknown,
  runGeneration: (input: ApplicationInput) => Promise<GeneratedDraftState>,
): Promise<GeneratedDraftState> {
  const parsedQuestion = draftQuestionSchema.safeParse(question);
  if (!draftIdSchema.safeParse(opportunityId).success || !parsedQuestion.success) {
    return { status: "error", message: "Choose a saved opportunity and enter an application question of up to 3,000 characters." };
  }
  try {
    const db = openDatabase();
    let opportunity;
    try {
      opportunity = getOpportunity(db, opportunityId);
      getDraft(db, opportunityId); // Check storage setup before spending a subscription request.
    } finally { db.close(); }
    if (!opportunity) return { status: "error", message: "This saved opportunity could not be found." };
    if (!opportunity.description?.trim()) return { status: "error", message: "Advertisement text is required before generating a draft." };
    const profile = await loadProfessionalProfile();
    if (profile.status !== "ready") return { status: "error", message: "The professional profile needs attention before generating a draft." };
    const result = await runGeneration({ ...createEvaluationInput(opportunity, profile.profile), question: parsedQuestion.data });
    if (result.status === "error") return result;
    // Bind the question to our input, rather than letting provider output change it.
    return { status: "success", draft: draftContentSchema.parse({ ...result.draft, question: parsedQuestion.data }) };
  } catch {
    return { status: "error", message: "The draft could not be prepared or returned as valid text. Saved text is unchanged. Check the profile and database setup. No automatic retry was made." };
  }
}

export function saveApplicationText(opportunityId: number, input: unknown, expectedRevision: number): DraftState {
  if (!draftIdSchema.safeParse(opportunityId).success || !draftContentSchema.safeParse(input).success
      || !draftRevisionSchema.safeParse(expectedRevision).success) {
    return { status: "error", message: "Enter a question and draft text within the displayed length limits before saving." };
  }
  try {
    const db = openDatabase();
    try {
      if (!getOpportunity(db, opportunityId)) return { status: "error", message: "This saved opportunity could not be found." };
      return { status: "success", draft: saveDraft(db, opportunityId, input, expectedRevision) };
    } finally { db.close(); }
  } catch (error) {
    return { status: "error", message: error instanceof DraftConflictError
      ? "A newer version was saved elsewhere. Your editor text is unchanged. Copy it before reopening the saved draft."
      : "The draft could not be saved. Your editor text is unchanged. Check the database setup and try again." };
  }
}
