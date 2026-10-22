import "server-only";

import OpenAI from "openai";
import {
  chatGPTCompletedResponseSchema,
  chatGPTModelCatalogSchema,
  chatGPTTextEventSchema,
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

    const client = new OpenAI({
      apiKey: accessToken,
      baseURL,
      organization: null,
      project: null,
      logLevel: "off",
      maxRetries: 0,
      timeout: 30_000,
      fetch: fetcher,
      fetchOptions: { redirect: "error", cache: "no-store" },
    });
    const { data: stream, response } = await client.responses.create({
      model: chatGPTTestModel,
      input: [{ role: "user", content: chatGPTTestPrompt }],
      store: false,
      stream: true,
    }, { signal: AbortSignal.timeout(30_000) }).withResponse();
    requestId = response.headers.get("x-request-id");
    const textParts = new Map<string, { outputIndex: number; contentIndex: number; text: string }>();
    for await (const event of stream) {
      if (event.type === "response.output_text.delta" || event.type === "response.output_text.done") {
        const part = chatGPTTextEventSchema.parse(event);
        const key = `${part.output_index}:${part.content_index}`;
        textParts.set(key, {
          outputIndex: part.output_index,
          contentIndex: part.content_index,
          // A finalized part replaces its accumulated deltas instead of duplicating them.
          text: part.type === "response.output_text.done" ? part.text : (textParts.get(key)?.text ?? "") + part.delta,
        });
      }
      if (event.type === "response.failed") {
        return failure(models, event.response.error?.code, undefined, requestId);
      }
      if (event.type === "error") return failure(models, event.code, undefined, requestId);
      if (event.type === "response.incomplete") {
        return { status: "error", models, message: "The test response was incomplete. No automatic retry was made." };
      }
      if (event.type === "response.completed") {
        const completed = chatGPTCompletedResponseSchema.parse(event.response);
        const finalText = completed.output.filter((item) => item.type === "message")
          .flatMap((item) => item.content ?? [])
          .filter((item) => item.type === "output_text")
          .map((item) => item.text ?? "").join("").trim();
        // Completion can omit the text already delivered through streaming events.
        // Keep that text private until this validated successful terminal event.
        const reply = finalText || [...textParts.values()]
          .sort((left, right) => left.outputIndex - right.outputIndex || left.contentIndex - right.contentIndex)
          .map((part) => part.text).join("").trim();
        if (!reply) {
          return { status: "error", models, message: "OpenAI completed the request, but no reply text was received. No retry was made.", ...(requestId ? { requestId } : {}) };
        }
        if (reply.length > 500) {
          return { status: "error", models, message: "OpenAI completed the request, but the test reply was unexpectedly long. No retry was made.", ...(requestId ? { requestId } : {}) };
        }
        return { status: "success", models, model: chatGPTTestModel, reply, testedAt: new Date().toISOString() };
      }
    }
    return { status: "error", models, message: "The connection ended without a completed response. No automatic retry was made." };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      return failure(models, error.code, error.status, error.requestID ?? requestId);
    }
    return failure(models, undefined, undefined, requestId);
  }
}
