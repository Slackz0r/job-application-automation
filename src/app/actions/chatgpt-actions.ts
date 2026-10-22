"use server";

import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getChatGPTAuth, localAppOrigin } from "../../lib/chatgpt-auth.ts";
import type { ChatGPTConnectionTestState } from "../../schemas/chatgpt-auth.ts";

export async function connectChatGPT() {
  const cookieStore = await cookies();
  const browserId = cookieStore.get("chatgpt_session")?.value ?? randomBytes(32).toString("base64url");
  let origin: string;
  try {
    origin = localAppOrigin((await headers()).get("host"));
  } catch {
    redirect("/?chatgpt=local_address#chatgpt");
  }
  let authorizationUrl: string;
  try {
    authorizationUrl = getChatGPTAuth().start(browserId, origin);
  } catch {
    redirect("/?chatgpt=failed#chatgpt");
  }
  cookieStore.set("chatgpt_session", browserId, { httpOnly: true, sameSite: "lax", path: "/", secure: false });
  redirect(authorizationUrl);
}

export async function signOutChatGPT() {
  const cookieStore = await cookies();
  const browserId = cookieStore.get("chatgpt_session")?.value;
  if (browserId) getChatGPTAuth().signOut(browserId);
  cookieStore.delete("chatgpt_session");
  redirect("/?chatgpt=signed_out#chatgpt");
}

export async function testChatGPTConnection(): Promise<ChatGPTConnectionTestState> {
  const browserId = (await cookies()).get("chatgpt_session")?.value ?? "";
  return getChatGPTAuth().testConnection(browserId);
}
