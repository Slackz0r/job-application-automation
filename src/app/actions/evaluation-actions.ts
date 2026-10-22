"use server";

import { cookies } from "next/headers";
import { getChatGPTAuth } from "../../lib/chatgpt-auth.ts";
import { compareSavedOpportunity, evaluateSavedOpportunity, type EvaluationState } from "../../lib/opportunity-evaluation.ts";
import { comparisonModel, type ComparisonState } from "../../schemas/opportunity-evaluation.ts";

export async function evaluateOpportunity(
  opportunityId: number,
  _previousState: EvaluationState | null,
  formData: FormData,
): Promise<EvaluationState> {
  return evaluateSavedOpportunity(opportunityId, formData, async (input) => {
    const browserId = (await cookies()).get("chatgpt_session")?.value ?? "";
    return getChatGPTAuth().evaluateOpportunity(browserId, opportunityId, input);
  });
}

export async function compareOpportunity(
  opportunityId: number,
): Promise<ComparisonState> {
  return compareSavedOpportunity(opportunityId, async (input) => {
    const browserId = (await cookies()).get("chatgpt_session")?.value ?? "";
    return getChatGPTAuth().evaluateOpportunity(browserId, opportunityId, input, comparisonModel);
  });
}
