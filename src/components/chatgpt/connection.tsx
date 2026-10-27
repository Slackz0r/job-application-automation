"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { connectChatGPT, signOutChatGPT, testChatGPTConnection } from "@/app/actions/chatgpt-actions";
import { chatGPTNotices, chatGPTTestPrompt, type ChatGPTConnection, type ChatGPTConnectionTestState, type ChatGPTNotice } from "@/schemas/chatgpt-auth";

function ConnectionButton({ connected }: { connected: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={connected ? "" : "chatgpt-sign-in"} type="submit" disabled={pending}>
      {pending ? connected ? "Signing out…" : "Opening sign-in…" : connected ? "Sign out of this app" : "Continue with ChatGPT"}
    </button>
  );
}

function ConnectionTest({ savedResult }: { savedResult?: ChatGPTConnectionTestState }) {
  const [state, action, pending] = useActionState(testChatGPTConnection, null);
  const result = state ?? savedResult;
  return (
    <div className="connection-test" aria-busy={pending}>
      <h3>Test the connection</h3>
      <p>Checks your available models, then asks GPT-6.1 Sol for one short reply using your subscription. No profile or advertisement is included.</p>
      <p className="muted">Test message: “{chatGPTTestPrompt}”</p>
      <div aria-live="polite">
        {pending && <p className="status">Checking models and sending the test message…</p>}
        {result?.status === "error" && <p className="error-message" role="alert">{result.message}</p>}
        {result?.status === "success" && <>
          <p className="status">Subscription response verified</p>
          <p>Reply: {result.reply}</p>
          <p className="muted">Model: {result.model}. Completed <time dateTime={result.testedAt}>{result.testedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}</time>.</p>
          <p className="muted">This confirms a test response worked. Choose a saved advertisement to run a separate job evaluation.</p>
        </>}
      </div>
      {result && result.models.length > 0 && <details>
        <summary>Available models ({result.models.length})</summary>
        <ul>{result.models.map((model, index) => <li key={`${model.slug}-${index}`}>{model.displayName} <span className="muted">({model.slug})</span></li>)}</ul>
      </details>}
      {result?.status !== "success" && <form action={action}>
        <button type="submit" disabled={pending}>{pending ? "Testing connection…" : "Test subscription connection"}</button>
      </form>}
      <p className="muted">One model request at most per attempt. No automatic retries or paid API fallback. A successful test is reused while this sign-in lasts.</p>
    </div>
  );
}

export function ChatGPTConnectionCard({ connection, notice }: { connection: ChatGPTConnection; notice?: ChatGPTNotice }) {
  const signedIn = connection.status !== "disconnected";
  // A URL notice cannot claim a successful connection without server-side state.
  const visibleNotice = (notice === "connected" && connection.status !== "permission_granted") ||
    (notice === "permission_missing" && connection.status !== "permission_missing") ? undefined : notice;
  return (
    <section id="chatgpt" className="card" aria-labelledby="chatgpt-heading">
      <p className="eyebrow">AI connection</p>
      <h2 id="chatgpt-heading">ChatGPT subscription</h2>
      <p className="status">
        {connection.status === "permission_granted" ? "Subscription permission granted"
          : connection.status === "permission_missing" ? "Signed in · subscription permission not granted"
          : connection.status === "expired" ? "Sign-in expired"
          : "Not connected"}
      </p>
      {connection.email && <p>Account: {connection.email}</p>}
      <p>Connect your existing subscription to evaluate advertisements and draft application text. Requests run only when you click an evaluation, generation or test button.</p>
      {visibleNotice && <p role="status" className={visibleNotice === "failed" || visibleNotice === "invalid_callback" || visibleNotice === "local_address" ? "error-message" : "muted"}>{chatGPTNotices[visibleNotice]}</p>}
      {connection.status === "permission_granted" && <ConnectionTest savedResult={connection.testResult} />}
      {connection.status !== "permission_granted" && (
        <form action={connectChatGPT}>
          <ConnectionButton connected={false} />
        </form>
      )}
      {signedIn && <form action={signOutChatGPT}><ConnectionButton connected /></form>}
      <p className="muted">Sign in again after restarting the app. Sign-in itself does not make a model request.</p>
      <p className="muted"><a href="https://chatgpt.com/settings/usage" target="_blank" rel="noreferrer">Manage ChatGPT usage and app permissions</a></p>
    </section>
  );
}
