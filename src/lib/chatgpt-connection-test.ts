import "server-only";

import { ChatGPTRequestError, requestChatGPTResponse } from "./chatgpt-response.ts";
import {
  chatGPTModelCatalogSchema,
  chatGPTTestModel,
  chatGPTTestPrompt,
  type ChatGPTConnectionTestState,
  type ChatGPTModel,
} from "../schemas/chatgpt-auth.ts";

const baseURL = "https://api.openai.com/v1";

function failure(models: ChatGPTModel[], code?: string | null, httpStatus?: number, requestId?: string | null): ChatGPTConnectionTestState {
  let message = "The connection test could not finish. No automatic retry or paid API fallback was used.";
  if (code === "subscription_sharing_usage_limit_exceeded" || httpStatus === 429) {
    message = "A subscription or app usage limit was reached. Check Manage ChatGPT usage before trying again.";
  } else if (httpStatus === 401 || code === "subscription_sharing_invalid_user") {
    message = "The subscription connection was not accepted. Please sign out of this app and sign in again.";
  } else if (code === "subscription_sharing_user_not_eligible") {
    message = "Subscription requests are unavailable for this account or workspace. The test stopped without switching billing.";
  } else if (httpStatus === 403) {
    message = "OpenAI did not permit this subscription request. The test stopped without switching billing.";
  } else if (httpStatus === 503 || code === "subscription_sharing_usage_unavailable" || code === "subscription_sharing_user_unavailable") {
    message = "The subscription service is temporarily unavailable. You can try again later.";
  }
  return {
    status: "error", models, message,
    ...(code ? { code } : {}),
    ...(httpStatus ? { httpStatus } : {}),
    ...(requestId ? { requestId } : {}),
  };
}

// This fixed-purpose check cannot accept profile data, advertisement text,
// a custom prompt, a different model, or API-key credentials from the UI.
export async function runChatGPTConnectionTest(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<ChatGPTConnectionTestState> {
  let models: ChatGPTModel[] = [];
  let requestId: string | null = null;
  try {
    const catalogResponse = await fetcher(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    requestId = catalogResponse.headers.get("x-request-id");
    if (!catalogResponse.ok) {
      const error = await catalogResponse.json().catch(() => null);
      const code = typeof error?.error?.code === "string" ? error.error.code : undefined;
      return failure(models, code, catalogResponse.status, requestId);
    }
    const catalog = chatGPTModelCatalogSchema.parse(await catalogResponse.json());
    models = catalog.models.filter((model) => model.visibility === "list")
      .map((model) => ({ slug: model.slug, displayName: model.display_name ?? model.slug }));
    if (!models.some((model) => model.slug === chatGPTTestModel)) {
      return {
        status: "error", models,
        message: "GPT-6.1 Sol was not listed for this connection. No model request was made. We can review the available models before choosing another.",
      };
    }

    const { text: reply } = await requestChatGPTResponse(accessToken, {
      model: chatGPTTestModel,
      input: [{ role: "user", content: chatGPTTestPrompt }],
    }, { fetcher });
    return { status: "success", models, model: chatGPTTestModel, reply, testedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof ChatGPTRequestError) {
      if (error.code === "empty_response" || error.code === "response_too_long" || error.code === "incomplete_response") {
        const message = error.code === "empty_response"
          ? "OpenAI completed the request, but no reply text was received. No retry was made."
          : error.code === "response_too_long"
            ? "The test reply was unexpectedly long. No retry was made."
            : "The test response was incomplete. No automatic retry was made.";
        return { status: "error", models, message, ...(error.requestId ? { requestId: error.requestId } : {}) };
      }
      return failure(models, error.code, error.httpStatus, error.requestId ?? requestId);
    }
    return failure(models, undefined, undefined, requestId);
  }
}
