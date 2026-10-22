import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import {
  chatGPTRegistrationSchema,
  chatGPTTokenResponseSchema,
  type ChatGPTConnection,
  type ChatGPTConnectionTestState,
  type ChatGPTNotice,
} from "../schemas/chatgpt-auth.ts";
import { runChatGPTConnectionTest } from "./chatgpt-connection-test.ts";
import { runChatGPTEvaluation } from "./chatgpt-evaluation.ts";
import type { EvaluationInput } from "./opportunity-evaluation.ts";
import type { LiveEvaluationState } from "../schemas/opportunity-evaluation.ts";

const issuer = "https://auth.openai.com";
const tokenEndpoint = `${issuer}/api/accounts/oauth/token`;
const resource = "https://api.openai.com/v1";
const dynamicClientId = "dynamic_agent_client";
const planScope = "chatgpt.tokens.use.direct";
const attemptLifetime = 10 * 60 * 1000;

type Registration = ReturnType<typeof chatGPTRegistrationSchema.parse>;
type Attempt = {
  state: string;
  nonce: string;
  verifier: string;
  redirectUri: string;
  expiresAt: number;
  registration: Registration;
};
type Connection = {
  email?: string;
  subject: string;
  clientId: string;
  idToken: string;
  accessToken?: string;
  refreshToken?: string;
  sharing: boolean;
  expiresAt: number;
  testResult?: ChatGPTConnectionTestState;
  testPromise?: Promise<ChatGPTConnectionTestState>;
  evaluation?: { opportunityId: number; promise: Promise<LiveEvaluationState> };
};

export function localAppOrigin(host: string | null) {
  if (!host || !/^127\.0\.0\.1(?::\d{1,5})?$/.test(host)) {
    throw new Error("A loopback address is required.");
  }
  return new URL(`http://${host}`).origin;
}

// The optional dependencies let tests use temporary files, local signing keys,
// and simulated HTTP responses instead of contacting OpenAI.
export function createChatGPTAuth(options: {
  registrationPath?: string;
  fetcher?: typeof fetch;
  keySet?: JWTVerifyGetKey;
  now?: () => number;
} = {}) {
  const registrationPath = options.registrationPath ?? join(process.cwd(), "data", "chatgpt-registration.json");
  const fetcher = options.fetcher ?? fetch;
  const keySet = options.keySet ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
    timeoutDuration: 10_000,
  });
  const now = options.now ?? Date.now;
  const attempts = new Map<string, Attempt>();
  const connections = new Map<string, Connection>();

  function saveRegistration(registration: Registration) {
    mkdirSync(dirname(registrationPath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${registrationPath}.${randomUUID()}.tmp`;
    // Explicitly select metadata fields so no credentials can reach disk.
    writeFileSync(temporaryPath, JSON.stringify({
      hostId: registration.hostId,
      clientId: registration.clientId,
      subject: registration.subject,
    }), { mode: 0o600, flag: "wx" });
    renameSync(temporaryPath, registrationPath);
  }

  function loadRegistration(): Registration {
    // This is user-supplied runtime metadata, never a build-time file dependency.
    if (existsSync(/* turbopackIgnore: true */ registrationPath)) {
      const registration = chatGPTRegistrationSchema.parse(JSON.parse(readFileSync(/* turbopackIgnore: true */ registrationPath, "utf8")));
      if (registration.clientId === dynamicClientId) throw new Error("Invalid saved client registration.");
      return registration;
    }
    const registration = { hostId: `urn:uuid:${randomUUID()}` };
    saveRegistration(registration);
    return registration;
  }

  function clearExpiredAttempts() {
    for (const [id, attempt] of attempts) {
      if (attempt.expiresAt <= now()) attempts.delete(id);
    }
    for (const connection of connections.values()) {
      // Retain only display information when credentials expire.
      if (connection.expiresAt <= now()) {
        connection.idToken = "";
        connection.accessToken = undefined;
        connection.refreshToken = undefined;
      }
    }
  }

  return {
    start(browserId: string, origin: string) {
      if (localAppOrigin(new URL(origin).host) !== origin) throw new Error("Invalid local origin.");
      clearExpiredAttempts();
      const registration = loadRegistration();
      const attempt: Attempt = {
        state: randomBytes(32).toString("base64url"),
        nonce: randomBytes(32).toString("base64url"),
        verifier: randomBytes(48).toString("base64url"),
        redirectUri: `${origin}/auth/callback`,
        expiresAt: now() + attemptLifetime,
        registration,
      };
      attempts.set(browserId, attempt);
      const url = new URL(`${issuer}/api/accounts/authorize`);
      url.search = new URLSearchParams({
        client_id: registration.clientId ?? dynamicClientId,
        ext_agent_host_id: registration.hostId,
        response_type: "code",
        redirect_uri: attempt.redirectUri,
        scope: `openid profile email offline_access resource.invoke ${planScope}`,
        resource,
        state: attempt.state,
        nonce: attempt.nonce,
        code_challenge_method: "S256",
        code_challenge: createHash("sha256").update(attempt.verifier).digest("base64url"),
      }).toString();
      if (!registration.clientId) url.searchParams.set("agent_name_hint", "Job Opportunity Automation");
      const active = connections.get(browserId);
      if (active?.idToken && active.clientId === registration.clientId) {
        url.searchParams.set("id_token_hint", active.idToken);
      }
      return url.toString();
    },

    async complete(browserId: string, callback: URL): Promise<ChatGPTNotice> {
      clearExpiredAttempts();
      const attempt = attempts.get(browserId);
      if (!attempt) return "expired";
      const params = callback.searchParams;
      if (`${callback.origin}${callback.pathname}` !== attempt.redirectUri ||
          params.getAll("state").length !== 1 || params.get("state") !== attempt.state) {
        return "invalid_callback";
      }
      // Consume before doing any asynchronous work: callbacks cannot be replayed.
      attempts.delete(browserId);
      if (params.has("error")) return params.get("error") === "access_denied" ? "cancelled" : "failed";
      const code = params.get("code");
      const clientId = params.get("client_id") ?? attempt.registration.clientId;
      if (!code || params.getAll("code").length !== 1 || params.getAll("client_id").length > 1 ||
          !clientId || clientId === dynamicClientId || clientId.length > 200 ||
          (attempt.registration.clientId && clientId !== attempt.registration.clientId)) {
        return "invalid_callback";
      }

      try {
        const current = loadRegistration();
        if (current.hostId !== attempt.registration.hostId ||
            (current.clientId && current.clientId !== clientId)) return "invalid_callback";
        // Retain an issued registration even if code exchange later fails.
        saveRegistration({ ...current, clientId });
        const response = await fetcher(tokenEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: clientId,
            code,
            code_verifier: attempt.verifier,
            redirect_uri: attempt.redirectUri,
            resource,
          }),
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
        });
        if (!response.ok) return "failed";
        const tokens = chatGPTTokenResponseSchema.parse(await response.json());
        const { payload } = await jwtVerify(tokens.id_token, keySet, {
          issuer,
          audience: clientId,
          requiredClaims: ["sub", "exp", "iat"],
          algorithms: ["RS256", "ES256"],
          clockTolerance: 5,
          currentDate: new Date(now()),
        });
        if (payload.nonce !== attempt.nonce || typeof payload.sub !== "string" || !payload.sub ||
            (current.subject && payload.sub !== current.subject)) return "failed";
        const sharing = tokens.scope.split(/\s+/).includes(planScope);
        if (sharing && (!tokens.access_token || tokens.token_type?.toLowerCase() !== "bearer" || !tokens.expires_in)) {
          return "failed";
        }
        const expiresAt = Math.min(
          payload.exp! * 1000,
          now() + (tokens.expires_in ?? Number.MAX_SAFE_INTEGER / 1000) * 1000,
        );
        if (expiresAt <= now()) return "failed";
        saveRegistration({ ...current, clientId, subject: payload.sub });
        connections.set(browserId, {
          email: typeof payload.email === "string" ? payload.email : undefined,
          subject: payload.sub,
          clientId,
          idToken: tokens.id_token,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          sharing,
          expiresAt,
        });
        return sharing ? "connected" : "permission_missing";
      } catch {
        // Neither provider responses nor credentials belong in logs or the UI.
        return "failed";
      }
    },

    status(browserId: string): ChatGPTConnection {
      clearExpiredAttempts();
      const connection = connections.get(browserId);
      if (!connection) return { status: "disconnected" };
      return {
        status: connection.expiresAt <= now() ? "expired" : connection.sharing ? "permission_granted" : "permission_missing",
        email: connection.email,
        ...(connection.testResult ? { testResult: connection.testResult } : {}),
      };
    },

    async testConnection(browserId: string): Promise<ChatGPTConnectionTestState> {
      clearExpiredAttempts();
      const connection = connections.get(browserId);
      if (!connection || connection.expiresAt <= now() || !connection.sharing || !connection.accessToken) {
        return { status: "error", models: [], message: "Sign in and grant subscription permission before running the connection test." };
      }
      if (connection.testResult?.status === "success") return connection.testResult;
      if (connection.testPromise) return connection.testPromise;
      // Concurrent submissions share one attempt; a verified success is reused.
      connection.testPromise = runChatGPTConnectionTest(connection.accessToken, fetcher)
        .then((result) => {
          if (connections.get(browserId) === connection) connection.testResult = result;
          return result;
        }).finally(() => { connection.testPromise = undefined; });
      return connection.testPromise;
    },

    async evaluateOpportunity(browserId: string, opportunityId: number, input: EvaluationInput): Promise<LiveEvaluationState> {
      clearExpiredAttempts();
      const connection = connections.get(browserId);
      if (!connection || connection.expiresAt <= now() || !connection.sharing || !connection.accessToken) {
        return { status: "error", message: "Sign in and grant subscription permission before evaluating an opportunity." };
      }
      if (connection.evaluation) {
        return connection.evaluation.opportunityId === opportunityId ? connection.evaluation.promise
          : { status: "error", message: "An evaluation is already running. Wait for it to finish before evaluating another opportunity." };
      }
      const promise = runChatGPTEvaluation(connection.accessToken, input, fetcher).then((result): LiveEvaluationState => {
        if (connections.get(browserId) !== connection || connection.expiresAt <= now()) {
          return { status: "error", message: "The connection ended before the evaluation could be saved. Sign in again before trying another request." };
        }
        return result;
      }).finally(() => { connection.evaluation = undefined; });
      connection.evaluation = { opportunityId, promise };
      return promise;
    },

    signOut(browserId: string) {
      attempts.delete(browserId);
      connections.delete(browserId);
    },
  };
}

// Share the in-memory state between the page, actions, and callback, including
// module reloads in development. A process restart intentionally forgets tokens.
const authGlobal = globalThis as typeof globalThis & {
  chatGPTAuth?: ReturnType<typeof createChatGPTAuth>;
};

export function getChatGPTAuth() {
  return authGlobal.chatGPTAuth ??= createChatGPTAuth();
}
