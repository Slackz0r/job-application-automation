import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { createChatGPTAuth, localAppOrigin } from "../../src/lib/chatgpt-auth.ts";
import type { EvaluationInput } from "../../src/lib/opportunity-evaluation.ts";

const keys = await generateKeyPair("RS256");
const publicKey = { ...await exportJWK(keys.publicKey), kid: "test-key", alg: "RS256" };
const keySet = createLocalJWKSet({ keys: [publicKey] });
const origin = "http://127.0.0.1:3000";
const clientId = "oaiapp_sanitized_example";

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "job-chatgpt-auth-"));
  t.after(() => {
    assert.equal(dirname(directory), tmpdir());
    rmSync(directory, { recursive: true, force: true });
  });
  const registrationPath = join(directory, "chatgpt-registration.json");
  let time = Date.now();
  let authorization: URL;
  const requests: { url: string; options?: RequestInit }[] = [];
  const inferenceRequests: string[] = [];
  const reply = {
    scope: "openid email chatgpt.tokens.use.direct",
    status: 200,
    payload: {} as Record<string, unknown>,
    accessToken: "synthetic-access-token-never-write-to-disk",
    tokenType: "Bearer",
    expiresIn: 3600,
    failNetwork: false,
    invalidJson: false,
    invalidSignature: false,
    beforeResponse: async () => {},
  };
  const fetcher: typeof fetch = async (url, options) => {
    if (String(url).startsWith("https://api.openai.com/v1/")) {
      inferenceRequests.push(String(url));
      if (String(url).endsWith("/models")) return Response.json({
        models: [{ slug: "gpt-6.1-sol", display_name: "GPT-6.1 Sol", visibility: "list" }],
      });
      await reply.beforeResponse();
      const isEvaluation = JSON.parse(String(options?.body)).instructions !== undefined;
      const text = isEvaluation ? JSON.stringify({
        recommendation: "needs_clarification", summary: "Synthetic result.", supportingEvidence: [], gapsAndUnknowns: ["Preferences are unknown."],
      }) : "Subscription connection works.";
      return new Response(`data: ${JSON.stringify({ type: "response.completed", response: {
        status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }],
      } })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    }
    requests.push({ url: String(url), options });
    if (reply.failNetwork) throw new Error("synthetic private provider details");
    if (reply.invalidJson) return new Response("not JSON");
    const signingKey = reply.invalidSignature ? (await generateKeyPair("RS256")).privateKey : keys.privateKey;
    const token = await new SignJWT({
      iss: "https://auth.openai.com", aud: clientId, sub: "synthetic-subject",
      iat: Math.floor(time / 1000), exp: Math.floor(time / 1000) + 3600,
      nonce: authorization.searchParams.get("nonce"), email: "example@example.test",
      ...reply.payload,
    }).setProtectedHeader({ alg: "RS256", kid: "test-key" }).sign(signingKey);
    return Response.json({
      id_token: token,
      access_token: reply.accessToken,
      refresh_token: "synthetic-refresh-token-never-write-to-disk",
      token_type: reply.tokenType,
      expires_in: reply.expiresIn,
      scope: reply.scope,
    }, { status: reply.status });
  };
  const dependencies = { registrationPath, fetcher, keySet, now: () => time };
  const auth = createChatGPTAuth(dependencies);
  function start(browserId = "browser-one") {
    authorization = new URL(auth.start(browserId, origin));
    return authorization;
  }
  function callback(extra: Record<string, string> = {}) {
    const url = new URL("/auth/callback", origin);
    url.search = new URLSearchParams({
      code: "synthetic-authorization-code",
      state: authorization.searchParams.get("state")!,
      client_id: clientId,
      ...extra,
    }).toString();
    return url;
  }
  return { auth, start, callback, requests, inferenceRequests, reply, registrationPath, dependencies, advance: (ms: number) => { time += ms; } };
}

test("prepares browser authorization without network calls and reuses a stable local host identifier", (t) => {
  const f = fixture(t);
  const first = f.start();
  assert.equal(first.origin, "https://auth.openai.com");
  assert.equal(first.pathname, "/api/accounts/authorize");
  assert.equal(first.searchParams.get("client_id"), "dynamic_agent_client");
  assert.equal(first.searchParams.get("agent_name_hint"), "Job Opportunity Automation");
  assert.equal(first.searchParams.get("redirect_uri"), `${origin}/auth/callback`);
  assert.equal(first.searchParams.get("resource"), "https://api.openai.com/v1");
  assert.ok(first.searchParams.get("scope")?.includes("chatgpt.tokens.use.direct"));
  assert.equal(first.searchParams.get("code_challenge_method"), "S256");
  const second = new URL(createChatGPTAuth(f.dependencies).start("another-browser", origin));
  assert.equal(second.searchParams.get("ext_agent_host_id"), first.searchParams.get("ext_agent_host_id"));
  assert.notEqual(second.searchParams.get("state"), first.searchParams.get("state"));
  assert.notEqual(second.searchParams.get("nonce"), first.searchParams.get("nonce"));
  assert.equal(f.requests.length, 0);
});

test("validates identity and plan permission, exposes only display data, and never persists credentials", async (t) => {
  const f = fixture(t);
  const authorization = f.start();
  const callback = f.callback();
  assert.equal(await f.auth.complete("browser-one", callback), "connected");
  assert.deepEqual(f.auth.status("browser-one"), { status: "permission_granted", email: "example@example.test" });
  assert.equal(f.requests.length, 1);
  const request = f.requests[0];
  assert.equal(request.url, "https://auth.openai.com/api/accounts/oauth/token");
  assert.equal(request.options?.method, "POST");
  assert.equal(request.options?.cache, "no-store");
  assert.equal(request.options?.redirect, "error");
  const body = request.options?.body as URLSearchParams;
  assert.equal(body.get("client_id"), clientId);
  assert.equal(body.get("redirect_uri"), authorization.searchParams.get("redirect_uri"));
  assert.equal(body.has("client_secret"), false);
  assert.equal(createHash("sha256").update(body.get("code_verifier")!).digest("base64url"), authorization.searchParams.get("code_challenge"));
  const saved = JSON.parse(readFileSync(f.registrationPath, "utf8"));
  assert.deepEqual(Object.keys(saved).sort(), ["clientId", "hostId", "subject"]);
  assert.equal(saved.subject, "synthetic-subject");
  assert.doesNotMatch(JSON.stringify(saved), /token|example@example|authorization-code/);
  assert.equal(await f.auth.complete("browser-one", callback), "expired");
  assert.equal(f.requests.length, 1);
  const returning = f.start();
  assert.equal(returning.searchParams.get("client_id"), clientId);
  assert.equal(returning.searchParams.has("agent_name_hint"), false);
  assert.ok(returning.searchParams.get("id_token_hint"));
});

test("identity sign-in and callback scopes cannot substitute for permission in the token response", async (t) => {
  const f = fixture(t);
  f.start();
  f.reply.scope = "openid email";
  assert.equal(await f.auth.complete("browser-one", f.callback({ scope: "chatgpt.tokens.use.direct" })), "permission_missing");
  assert.equal(f.auth.status("browser-one").status, "permission_missing");
});

test("rejects another browser, wrong state, or changed callback origin before exchanging a code", async (t) => {
  const f = fixture(t);
  f.start();
  assert.equal(await f.auth.complete("another-browser", f.callback()), "expired");
  assert.equal(await f.auth.complete("browser-one", f.callback({ state: "wrong-state" })), "invalid_callback");
  const changedOrigin = f.callback();
  changedOrigin.port = "3001";
  assert.equal(await f.auth.complete("browser-one", changedOrigin), "invalid_callback");
  const repeatedState = f.callback();
  repeatedState.searchParams.append("state", repeatedState.searchParams.get("state")!);
  assert.equal(await f.auth.complete("browser-one", repeatedState), "invalid_callback");
  assert.equal(f.requests.length, 0);
  assert.equal(await f.auth.complete("browser-one", f.callback({ error: "access_denied" })), "cancelled");
  assert.equal(f.requests.length, 0);
});

test("requires an issued registration ID and rejects a different ID on returning sign-in", async (t) => {
  const f = fixture(t);
  f.start();
  const missing = f.callback();
  missing.searchParams.delete("client_id");
  assert.equal(await f.auth.complete("browser-one", missing), "invalid_callback");
  assert.equal(f.requests.length, 0);
  f.start();
  assert.equal(await f.auth.complete("browser-one", f.callback()), "connected");
  f.start();
  assert.equal(await f.auth.complete("browser-one", f.callback({ client_id: "oaiapp_different" })), "invalid_callback");
  assert.equal(f.requests.length, 1);
  assert.equal(f.auth.status("browser-one").status, "permission_granted");
});

test("rejects invalid signatures, issuer, audience, nonce, expiry, or subject", async (t) => {
  for (const payload of [
    { iss: "https://untrusted.example" }, { aud: "another-client" }, { nonce: "wrong-nonce" },
    { exp: 1 }, { exp: undefined }, { sub: "" },
  ]) {
    const f = fixture(t);
    f.start();
    f.reply.payload = payload;
    assert.equal(await f.auth.complete("browser-one", f.callback()), "failed");
    assert.equal(f.auth.status("browser-one").status, "disconnected");
  }
  const f = fixture(t);
  f.start();
  f.reply.invalidSignature = true;
  assert.equal(await f.auth.complete("browser-one", f.callback()), "failed");
});

test("does not report plan permission without usable bearer credentials", async (t) => {
  for (const tokenType of ["", "Basic"]) {
    const f = fixture(t);
    f.start();
    f.reply.tokenType = tokenType;
    assert.equal(await f.auth.complete("browser-one", f.callback()), "failed");
  }
  const f = fixture(t);
  f.start();
  f.reply.accessToken = "";
  assert.equal(await f.auth.complete("browser-one", f.callback()), "failed");
});

test("failed or cancelled reconnection preserves the existing connection and verifies returning identity", async (t) => {
  const f = fixture(t);
  f.start();
  assert.equal(await f.auth.complete("browser-one", f.callback()), "connected");
  for (const failure of ["network", "http", "json", "identity", "cancelled"]) {
    f.start();
    f.reply.failNetwork = failure === "network";
    f.reply.status = failure === "http" ? 500 : 200;
    f.reply.invalidJson = failure === "json";
    f.reply.payload = failure === "identity" ? { sub: "another-subject" } : {};
    const result = await f.auth.complete("browser-one", f.callback(failure === "cancelled" ? { error: "access_denied" } : {}));
    assert.equal(result, failure === "cancelled" ? "cancelled" : "failed");
    assert.equal(f.auth.status("browser-one").status, "permission_granted");
  }
  assert.equal(JSON.parse(readFileSync(f.registrationPath, "utf8")).subject, "synthetic-subject");
});

test("expires attempts, forgets connections on restart, and retains registration after local sign-out", async (t) => {
  const f = fixture(t);
  f.start();
  f.advance(10 * 60 * 1000);
  assert.equal(await f.auth.complete("browser-one", f.callback()), "expired");
  assert.equal(f.requests.length, 0);
  f.start();
  assert.equal(await f.auth.complete("browser-one", f.callback()), "connected");
  const restarted = createChatGPTAuth(f.dependencies);
  assert.deepEqual(restarted.status("browser-one"), { status: "disconnected" });
  assert.equal(new URL(restarted.start("browser-one", origin)).searchParams.get("client_id"), clientId);
  f.advance(3600 * 1000);
  assert.equal(f.auth.status("browser-one").status, "expired");
  f.auth.signOut("browser-one");
  assert.deepEqual(f.auth.status("browser-one"), { status: "disconnected" });
  assert.equal(JSON.parse(readFileSync(f.registrationPath, "utf8")).clientId, clientId);
});

test("only accepts explicit HTTP loopback origins and does not create registration files for other origins", (t) => {
  const f = fixture(t);
  assert.equal(localAppOrigin("127.0.0.1:3000"), origin);
  for (const host of [null, "localhost:3000", "127.0.0.1.example:3000", "127.0.0.1:3000@evil.example", "0.0.0.0:3000"]) {
    assert.throws(() => localAppOrigin(host));
  }
  for (const url of ["http://localhost:3000", "https://127.0.0.1:3000", "http://127.0.0.1:3000/path"]) {
    assert.throws(() => f.auth.start("browser-one", url));
  }
  assert.equal(existsSync(f.registrationPath), false);
});

test("connection tests require the correct browser, valid credentials, and subscription permission", async (t) => {
  const f = fixture(t);
  assert.equal((await f.auth.testConnection("browser-one")).status, "error");
  f.start();
  f.reply.scope = "openid email";
  assert.equal(await f.auth.complete("browser-one", f.callback()), "permission_missing");
  assert.equal((await f.auth.testConnection("browser-one")).status, "error");
  f.start();
  f.reply.scope += " chatgpt.tokens.use.direct";
  assert.equal(await f.auth.complete("browser-one", f.callback()), "connected");
  assert.equal((await f.auth.testConnection("another-browser")).status, "error");
  f.advance(3600 * 1000);
  assert.equal((await f.auth.testConnection("browser-one")).status, "error");
  assert.equal(f.inferenceRequests.length, 0);
});

test("concurrent tests share one request and successful tests are reused without exposing or persisting credentials", async (t) => {
  const f = fixture(t);
  f.start();
  assert.equal(await f.auth.complete("browser-one", f.callback()), "connected");
  const results = await Promise.all([f.auth.testConnection("browser-one"), f.auth.testConnection("browser-one")]);
  assert.equal(results[0].status, "success");
  assert.deepEqual(results[1], results[0]);
  assert.deepEqual(await f.auth.testConnection("browser-one"), results[0]);
  assert.deepEqual(f.inferenceRequests, ["https://api.openai.com/v1/models", "https://api.openai.com/v1/responses"]);
  assert.deepEqual(f.auth.status("browser-one").testResult, results[0]);
  assert.doesNotMatch(JSON.stringify(f.auth.status("browser-one")), /synthetic-access-token|synthetic-refresh-token/);
  assert.doesNotMatch(readFileSync(f.registrationPath, "utf8"), /token|Subscription connection works/);
  f.auth.signOut("browser-one");
  assert.equal((await f.auth.testConnection("browser-one")).status, "error");
});


const evaluationInput: EvaluationInput = {
  opportunity: { title: "Example Developer", description: "Develop web interfaces.", company: null, location: null },
  profile: { skillsAndCompetencies: {}, experiences: { professional: [], education: [] }, careerPreferences: {} },
};

test("live evaluations require active browser-bound subscription permission", async (t) => {
  const f = fixture(t);
  assert.equal((await f.auth.evaluateOpportunity("browser-one", 1, evaluationInput)).status, "error");
  f.reply.scope = "openid email";
  f.start();
  assert.equal(await f.auth.complete("browser-one", f.callback()), "permission_missing");
  assert.equal((await f.auth.evaluateOpportunity("browser-one", 1, evaluationInput)).status, "error");
  f.reply.scope = "openid email chatgpt.tokens.use.direct";
  f.start();
  assert.equal(await f.auth.complete("browser-one", f.callback()), "connected");
  assert.equal((await f.auth.evaluateOpportunity("other-browser", 1, evaluationInput)).status, "error");
  f.advance(3600_001);
  assert.equal((await f.auth.evaluateOpportunity("browser-one", 1, evaluationInput)).status, "error");
  assert.equal(f.inferenceRequests.length, 0);
});

test("duplicate evaluation clicks share one request and another job waits for it to finish", async (t) => {
  const f = fixture(t);
  f.start();
  assert.equal(await f.auth.complete("browser-one", f.callback()), "connected");
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  f.reply.beforeResponse = () => held;
  const first = f.auth.evaluateOpportunity("browser-one", 1, evaluationInput);
  const duplicate = f.auth.evaluateOpportunity("browser-one", 1, evaluationInput);
  const other = await f.auth.evaluateOpportunity("browser-one", 2, evaluationInput);
  assert.equal(other.status, "error");
  if (other.status === "error") assert.match(other.message, /already running/);
  release();
  const [result, repeated] = await Promise.all([first, duplicate]);
  assert.equal(result.status, "success");
  assert.deepEqual(repeated, result);
  assert.equal(f.inferenceRequests.filter((url) => url.endsWith("/responses")).length, 1);
  assert.equal((await f.auth.evaluateOpportunity("browser-one", 2, evaluationInput)).status, "success");
  assert.equal(f.inferenceRequests.filter((url) => url.endsWith("/responses")).length, 2);
  assert.doesNotMatch(readFileSync(f.registrationPath, "utf8"), /Synthetic result|Develop web interfaces|synthetic-access-token/);
  assert.doesNotMatch(JSON.stringify(f.auth.status("browser-one")), /Synthetic result|Develop web interfaces|synthetic-access-token/);
});

test("signing out during a request prevents its result from being saved through that connection", async (t) => {
  const f = fixture(t);
  f.start();
  assert.equal(await f.auth.complete("browser-one", f.callback()), "connected");
  let release!: () => void;
  let began!: () => void;
  const started = new Promise<void>((resolve) => { began = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  f.reply.beforeResponse = () => { began(); return held; };
  const pending = f.auth.evaluateOpportunity("browser-one", 1, evaluationInput);
  await started;
  f.auth.signOut("browser-one");
  release();
  const result = await pending;
  assert.equal(result.status, "error");
  if (result.status === "error") assert.match(result.message, /connection ended/i);
});
