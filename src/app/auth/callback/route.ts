import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getChatGPTAuth, localAppOrigin } from "../../../lib/chatgpt-auth.ts";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  let origin: string;
  try {
    origin = localAppOrigin(request.headers.get("host"));
  } catch {
    return new Response("Open the app using its 127.0.0.1 address.", { status: 400 });
  }
  const browserId = (await cookies()).get("chatgpt_session")?.value ?? "";
  const callback = new URL(`/auth/callback${request.nextUrl.search}`, origin);
  const notice = await getChatGPTAuth().complete(browserId, callback);
  const response = NextResponse.redirect(new URL(`/?chatgpt=${notice}#chatgpt`, origin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
