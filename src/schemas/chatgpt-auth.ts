import { z } from "zod";

// Registration identifiers are retained locally; credentials are never written here.
export const chatGPTRegistrationSchema = z.object({
  hostId: z.string().startsWith("urn:uuid:"),
  clientId: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).optional(),
});

export const chatGPTTokenResponseSchema = z.object({
  id_token: z.string().min(1),
  access_token: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
  token_type: z.string().optional(),
  expires_in: z.number().int().positive().optional(),
  scope: z.string().default(""),
});

export type ChatGPTConnection = {
  status: "disconnected" | "permission_granted" | "permission_missing" | "expired";
  email?: string;
  testResult?: ChatGPTConnectionTestState;
};

export const chatGPTTestModel = "gpt-6.1-sol";
export const chatGPTTestPrompt = "Reply with exactly: Subscription connection works.";

export const chatGPTModelCatalogSchema = z.object({
  models: z.array(z.object({
    slug: z.string().min(1).max(200),
    display_name: z.string().min(1).max(200).optional(),
    visibility: z.string(),
  })),
});

export const chatGPTCompletedResponseSchema = z.object({
  status: z.literal("completed"),
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  })),
});

export type ChatGPTModel = { slug: string; displayName: string };
export type ChatGPTConnectionTestState =
  | { status: "success"; models: ChatGPTModel[]; model: string; reply: string; testedAt: string }
  | { status: "error"; models: ChatGPTModel[]; message: string; requestId?: string; code?: string; httpStatus?: number };

export const chatGPTNotices = {
  connected: "Sign-in verified. Permission to use your ChatGPT subscription was granted.",
  permission_missing: "Sign-in verified, but permission to use your ChatGPT subscription was not granted.",
  cancelled: "Sign-in was cancelled. You can try again whenever you are ready.",
  expired: "This sign-in attempt expired or the app restarted. Please try again.",
  invalid_callback: "The sign-in reply could not be matched to this browser. Please try again.",
  failed: "The connection could not be verified. Check your connection and try signing in again.",
  local_address: "To connect, open this app using its http://127.0.0.1 address rather than localhost.",
  signed_out: "Signed out of this app. Your ChatGPT browser sign-in and app permission settings are unchanged.",
} as const;

export type ChatGPTNotice = keyof typeof chatGPTNotices;
