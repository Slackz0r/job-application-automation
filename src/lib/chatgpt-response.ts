import "server-only";

import OpenAI from "openai";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses";
import { chatGPTCompletedResponseSchema, chatGPTTextEventSchema } from "../schemas/chatgpt-auth.ts";

export class ChatGPTRequestError extends Error {
  code: string;
  httpStatus?: number;
  requestId?: string;

  constructor(code: string, httpStatus?: number, requestId?: string) {
    super("The subscription request could not complete.");
    this.code = code;
    this.httpStatus = httpStatus;
    this.requestId = requestId;
  }
}

// Shared transport only: callers supply trusted, fixed-purpose request settings.
// Credentials, prompts, partial output, and provider error messages stay private.
export async function requestChatGPTResponse(
  accessToken: string,
  request: Omit<ResponseCreateParamsStreaming, "stream" | "store">,
  { fetcher = fetch, timeout = 30_000, maxTextLength = 500 } = {},
): Promise<{ text: string; requestId?: string }> {
  let requestId: string | undefined;
  try {
    const client = new OpenAI({
      apiKey: accessToken,
      baseURL: "https://api.openai.com/v1",
      organization: null,
      project: null,
      logLevel: "off",
      maxRetries: 0,
      timeout,
      fetch: fetcher,
      fetchOptions: { redirect: "error", cache: "no-store" },
    });
    const { data: stream, response } = await client.responses.create({
      ...request, store: false, stream: true,
    }, { signal: AbortSignal.timeout(timeout) }).withResponse();
    requestId = response.headers.get("x-request-id") ?? undefined;
    const parts = new Map<string, { outputIndex: number; contentIndex: number; text: string }>();
    for await (const event of stream) {
      if (event.type === "response.output_text.delta" || event.type === "response.output_text.done") {
        const part = chatGPTTextEventSchema.parse(event);
        const key = `${part.output_index}:${part.content_index}`;
        parts.set(key, {
          outputIndex: part.output_index,
          contentIndex: part.content_index,
          text: part.type === "response.output_text.done" ? part.text : (parts.get(key)?.text ?? "") + part.delta,
        });
        if ([...parts.values()].reduce((length, part) => length + part.text.length, 0) > maxTextLength) {
          throw new ChatGPTRequestError("response_too_long", undefined, requestId);
        }
      }
      if (event.type === "response.refusal.delta" || event.type === "response.refusal.done") {
        throw new ChatGPTRequestError("refused_response", undefined, requestId);
      }
      if (event.type === "response.failed") {
        throw new ChatGPTRequestError(event.response.error?.code ?? "failed_response", undefined, requestId);
      }
      if (event.type === "error") throw new ChatGPTRequestError(event.code ?? "failed_response", undefined, requestId);
      if (event.type === "response.incomplete") throw new ChatGPTRequestError("incomplete_response", undefined, requestId);
      if (event.type === "response.completed") {
        const completed = chatGPTCompletedResponseSchema.parse(event.response);
        const content = completed.output.filter((item) => item.type === "message").flatMap((item) => item.content ?? []);
        if (content.some((item) => item.type === "refusal")) {
          throw new ChatGPTRequestError("refused_response", undefined, requestId);
        }
        const finalText = content.filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("").trim();
        // Completion may omit text already delivered through deltas or done events.
        const text = finalText || [...parts.values()]
          .sort((left, right) => left.outputIndex - right.outputIndex || left.contentIndex - right.contentIndex)
          .map((part) => part.text).join("").trim();
        if (!text) throw new ChatGPTRequestError("empty_response", undefined, requestId);
        if (text.length > maxTextLength) throw new ChatGPTRequestError("response_too_long", undefined, requestId);
        return { text, requestId };
      }
    }
    throw new ChatGPTRequestError("incomplete_response", undefined, requestId);
  } catch (error) {
    if (error instanceof ChatGPTRequestError) throw error;
    if (error instanceof OpenAI.APIError) {
      throw new ChatGPTRequestError(error.code ?? "request_failed", error.status, error.requestID ?? requestId);
    }
    throw new ChatGPTRequestError("invalid_response", undefined, requestId);
  }
}
