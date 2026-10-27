"use server";

import { cookies } from "next/headers";
import { getChatGPTAuth } from "../../lib/chatgpt-auth.ts";
import { generateForOpportunity, loadApplicationDraft, saveApplicationText } from "../../lib/application-generation.ts";
import type { DraftContent } from "../../schemas/application-draft.ts";

export async function openApplicationDraft(opportunityId: number) {
  return loadApplicationDraft(opportunityId);
}

export async function generateApplicationDraft(opportunityId: number, question: string) {
  return generateForOpportunity(opportunityId, question, async (input) => {
    const browserId = (await cookies()).get("chatgpt_session")?.value ?? "";
    return getChatGPTAuth().generateApplication(browserId, opportunityId, input);
  });
}

export async function saveApplicationDraft(opportunityId: number, input: DraftContent, expectedRevision: number) {
  return saveApplicationText(opportunityId, input, expectedRevision);
}
