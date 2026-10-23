import assert from "node:assert/strict";
import { test } from "node:test";
import { runChatGPTConnectionTest } from "../../src/lib/chatgpt-connection-test.ts";
import { chatGPTTestModel, chatGPTTestPrompt } from "../../src/schemas/chatgpt-auth.ts";

const catalog = { models: [
  { slug: "internal-example", display_name: "Internal", visibility: "hide" },
  { slug: chatGPTTestModel, display_name: "GPT-6.1 Sol", visibility: "list" },
  { slug: "example-other-model", display_name: "Other example", visibility: "list" },
] };

function stream(events: unknown[]) {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: { "Content-Type": "text/event-stream", "x-request-id": "synthetic-response-request" },
  });
}

function completed(text = "Subscription connection works.") {
  return {
    type: "response.completed", response: {
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text }] }],
    },
  };
}

function textDelta(delta: string, outputIndex = 0, contentIndex = 0) {
  return { type: "response.output_text.delta", output_index: outputIndex, content_index: contentIndex, delta };
}

function textDone(text: string, outputIndex = 0, contentIndex = 0) {
  return { type: "response.output_text.done", output_index: outputIndex, content_index: contentIndex, text };
}

test("keeps streamed text when the completed event contains an empty output array", async () => {
  const result = await runChatGPTConnectionTest("synthetic-token", async (input) => {
    if (String(input).endsWith("/models")) return Response.json(catalog);
    return stream([
      textDelta("Subscription "), textDelta("connection works."),
      { type: "response.completed", response: { status: "completed", output: [] } },
    ]);
  });
  assert.equal(result.status, "success");
  if (result.status === "success") assert.equal(result.reply, "Subscription connection works.");
});

test("accepts finalized text followed by completion without a repeated output snapshot", async () => {
  const result = await runChatGPTConnectionTest("synthetic-token", async (input) => {
    if (String(input).endsWith("/models")) return Response.json(catalog);
    return stream([textDone("Subscription connection works."), { type: "response.completed", response: { status: "completed" } }]);
  });
  assert.equal(result.status, "success");
  if (result.status === "success") assert.equal(result.reply, "Subscription connection works.");
});

test("finalized text replaces its deltas and multiple parts retain output order without duplication", async () => {
  const result = await runChatGPTConnectionTest("synthetic-token", async (input) => {
    if (String(input).endsWith("/models")) return Response.json(catalog);
    return stream([
      textDelta("works.", 1),
      textDelta("Subscription "), textDone("Subscription "),
      textDelta("connection ", 0, 1), textDone("connection ", 0, 1), textDone("works.", 1),
      { type: "response.completed", response: { status: "completed", output: [] } },
    ]);
  });
  assert.equal(result.status, "success");
  if (result.status === "success") assert.equal(result.reply, "Subscription connection works.");
});

test("lists visible models and sends only the agreed fixed message with subscription credentials", async () => {
  const requests: { url: string; options?: RequestInit }[] = [];
  const result = await runChatGPTConnectionTest("synthetic-oauth-token", async (input, options) => {
    const url = String(input);
    requests.push({ url, options });
    assert.equal(new Headers(options?.headers).get("Authorization"), "Bearer synthetic-oauth-token");
    assert.equal(new Headers(options?.headers).get("OpenAI-Organization"), null);
    assert.equal(new Headers(options?.headers).get("OpenAI-Project"), null);
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.redirect, "error");
    assert.ok(options?.signal instanceof AbortSignal);
    if (url.endsWith("/models")) return Response.json(catalog);
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options?.method, "POST");
    assert.deepEqual(JSON.parse(String(options?.body)), {
      model: chatGPTTestModel, input: [{ role: "user", content: chatGPTTestPrompt }], store: false, stream: true,
    });
    return stream([textDelta("partial text must not establish success"), completed()]);
  });
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.reply, "Subscription connection works.");
  assert.equal(result.model, chatGPTTestModel);
  assert.deepEqual(result.models.map((model) => model.slug), [chatGPTTestModel, "example-other-model"]);
  assert.ok(Number.isFinite(Date.parse(result.testedAt)));
  assert.deepEqual(requests.map((request) => request.url), ["https://api.openai.com/v1/models", "https://api.openai.com/v1/responses"]);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-oauth-token/);
});

test("does not silently choose another model when the agreed model is absent or hidden", async () => {
  for (const models of [[], [{ slug: chatGPTTestModel, visibility: "hide" }], [{ slug: "example-other", visibility: "list" }]]) {
    let requests = 0;
    const result = await runChatGPTConnectionTest("synthetic-token", async () => {
      requests++;
      return Response.json({ models });
    });
    assert.equal(result.status, "error");
    assert.equal(requests, 1);
    if (result.status === "error") assert.match(result.message, /No model request was made/);
  }
});

test("stops before inference on catalog errors or malformed model data", async () => {
  for (const payload of [null, {}, { data: [] }, { models: [{ slug: "", visibility: "list" }] }]) {
    let requests = 0;
    const result = await runChatGPTConnectionTest("synthetic-token", async () => {
      requests++;
      return Response.json(payload);
    });
    assert.equal(result.status, "error");
    assert.equal(requests, 1);
  }
  const result = await runChatGPTConnectionTest("synthetic-token", async () => new Response("private diagnostic text", {
    status: 403, headers: { "x-request-id": "synthetic-catalog-denied" },
  }));
  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.httpStatus, 403);
  assert.equal(result.requestId, "synthetic-catalog-denied");
  assert.doesNotMatch(JSON.stringify(result), /private diagnostic text/);
});

test("does not accept partial, interrupted, failed, incomplete, empty, or malformed streams as success", async () => {
  for (const events of [
    [textDelta("looks successful")],
    [textDone("looks successful")],
    [textDelta("looks successful"), { type: "response.failed", response: { error: { code: "subscription_sharing_usage_limit_exceeded" } } }],
    [textDone("looks successful"), { type: "response.incomplete", response: { status: "incomplete" } }],
    [{ type: "error", code: "subscription_sharing_usage_unavailable", message: "private provider detail" }],
    [completed("")], [completed("x".repeat(501))],
    [textDelta("x".repeat(501)), { type: "response.completed", response: { status: "completed", output: [] } }],
    [textDelta("looks successful"), { type: "response.completed", response: { status: "incomplete", output: [] } }],
    [{ type: "response.output_text.delta", output_index: 0, content_index: 0, delta: 123 }, completed()],
    [{ type: "response.output_text.done", output_index: -1, content_index: 0, text: "looks successful" }, completed()],
  ]) {
    let requests = 0;
    const result = await runChatGPTConnectionTest("synthetic-token", async (input) => {
      requests++;
      return String(input).endsWith("/models") ? Response.json(catalog) : stream(events);
    });
    assert.equal(result.status, "error");
    assert.equal(requests, 2);
    assert.doesNotMatch(JSON.stringify(result), /looks successful|private provider detail/);
  }
});

test("distinguishes a genuinely empty completed reply from an unexpectedly long one", async () => {
  for (const [text, expectedMessage] of [["", /no reply text/], ["x".repeat(501), /unexpectedly long/]] as const) {
    const result = await runChatGPTConnectionTest("synthetic-token", async (input) => {
      return String(input).endsWith("/models") ? Response.json(catalog) : stream([completed(text)]);
    });
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.match(result.message, expectedMessage);
      assert.equal(result.requestId, "synthetic-response-request");
    }
  }
});

test("HTTP, usage-limit, and transport failures do not trigger SDK retries or another billing path", async () => {
  for (const status of [401, 403, 429, 500, 503]) {
    let requests = 0;
    const result = await runChatGPTConnectionTest("synthetic-token", async (input) => {
      requests++;
      if (String(input).endsWith("/models")) return Response.json(catalog);
      return Response.json({ error: { code: "subscription_sharing_usage_limit_exceeded", message: "private provider text" } }, {
        status, headers: { "x-request-id": "synthetic-request-failed" },
      });
    });
    assert.equal(result.status, "error");
    if (result.status !== "error") continue;
    assert.equal(result.httpStatus, status);
    assert.equal(result.code, "subscription_sharing_usage_limit_exceeded");
    assert.equal(result.requestId, "synthetic-request-failed");
    assert.equal(requests, 2);
    assert.doesNotMatch(JSON.stringify(result), /private provider text/);
  }
  let requests = 0;
  const result = await runChatGPTConnectionTest("synthetic-token", async (input) => {
    requests++;
    if (String(input).endsWith("/models")) return Response.json(catalog);
    throw new DOMException("private transport detail", "AbortError");
  });
  assert.equal(result.status, "error");
  assert.equal(requests, 2);
  assert.doesNotMatch(JSON.stringify(result), /private transport detail/);
});
