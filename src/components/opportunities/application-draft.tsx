"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { generateApplicationDraft, openApplicationDraft, saveApplicationDraft } from "@/app/actions/application-actions";
import type { SavedDraft } from "@/schemas/application-draft";

const defaultQuestion = "Motivera hur din erfarenhet är relevant för tjänsten.";

export function ApplicationDraft({
  opportunityId,
  hasDescription,
  onDirtyChange,
}: {
  opportunityId: number;
  hasDescription: boolean;
  onDirtyChange: (id: number, dirty: boolean) => void;
}) {
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState<SavedDraft | null>(null);
  const [question, setQuestion] = useState(defaultQuestion);
  const [text, setText] = useState("");
  const [model, setModel] = useState<SavedDraft["model"]>(null);
  const [allowReplace, setAllowReplace] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const dirty = loaded && (
    question !== (saved?.question ?? defaultQuestion) ||
    text !== (saved?.text ?? "")
  );
  const busyOrDirty = dirty || (loaded && pending);

  // Protect editor work when the surrounding list changes or the browser closes.
  useEffect(() => {
    onDirtyChange(opportunityId, busyOrDirty);
  }, [onDirtyChange, opportunityId, busyOrDirty]);

  useEffect(() => {
    if (!busyOrDirty) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [busyOrDirty]);

  // Share pending state and request-error feedback across draft actions.
  function run(task: () => Promise<void>) {
    setError("");
    setMessage("");

    startTransition(async () => {
      try {
        await task();
      } catch {
        setError("The request could not complete. Your editor text is unchanged. Please try again.");
      }
    });
  }

  // Draft actions: load saved content, generate editor text, save edits, and copy for manual use.
  function open() {
    if (dirty && !allowReplace) return;

    run(async () => {
      const result = await openApplicationDraft(opportunityId);

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      setSaved(result.draft);
      setQuestion(result.draft?.question ?? defaultQuestion);
      setText(result.draft?.text ?? "");
      setModel(result.draft?.model ?? null);
      setAllowReplace(false);
      setLoaded(true);
    });
  }

  function generate() {
    if (text.trim() && !allowReplace) return;

    run(async () => {
      const result = await generateApplicationDraft(opportunityId, question);

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      setText(result.draft.text);
      setModel(result.draft.model);
      setAllowReplace(false);
      setMessage("Draft generated. Review and edit it, then save your changes.");
    });
  }

  function save() {
    run(async () => {
      const result = await saveApplicationDraft(opportunityId, { question, text, model }, saved?.revision ?? 0);

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      if (!result.draft) return;

      setSaved(result.draft);
      setQuestion(result.draft.question);
      setText(result.draft.text);
      setAllowReplace(false);
      setMessage("Changes saved on this computer.");
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage("Draft copied.");
      setError("");
    } catch {
      setError("Copy was unavailable. Select the draft text and copy it manually.");
    }
  }

  return (
    <section className="workflow-section application-draft" aria-label="Application draft" aria-busy={pending}>
      <h5 className="workflow-heading">Application draft</h5>

      {!loaded && (
        <>
          <p className="muted">
            Prepare a Swedish motivation for this advertisement. Opening the editor makes no AI request.
          </p>

          <button type="button" onClick={open} disabled={pending}>
            {pending ? "Opening…" : "Prepare application"}
          </button>
        </>
      )}

      {loaded && (
        <>
          <p className="muted">
            Paste the employer’s question or use the suggested prompt. Generate with GPT-6.1 Sol using your subscription,
            then review the text before copying it.
          </p>

          <details className="request-details">
            <summary>About this generation</summary>
            <p className="muted">
              Sends this question, the advertisement, skills and competencies, professional experience, education,
              and career preferences. Personality and interests are excluded. One request per attempt; no automatic
              retries or paid API fallback.
            </p>
          </details>

          <fieldset className="search-fields" disabled={pending}>
            <div className="field">
              <label htmlFor={`${id}-question`}>Application question</label>
              <textarea
                id={`${id}-question`}
                value={question}
                maxLength={3000}
                rows={3}
                onChange={(event) => {
                  setQuestion(event.target.value);
                  setAllowReplace(false);
                }}
              />
            </div>

            <div className="field">
              <label htmlFor={`${id}-text`}>Motivation draft (Swedish)</label>
              <textarea
                id={`${id}-text`}
                value={text}
                maxLength={12000}
                rows={12}
                onChange={(event) => {
                  setText(event.target.value);
                  setAllowReplace(false);
                  setMessage("");
                }}
              />
            </div>

            <p className="muted">
              Question: {question.length}/3,000 characters. Draft: {text.length}/12,000 characters.
              Review all claims. Supply availability, salary and requirement checkboxes yourself.
            </p>

            {dirty && (
              <p className="notice-message">
                Unsaved changes. Save or reopen the saved version before starting a new search.
              </p>
            )}

            {saved && (
              <p className="muted">
                Saved {saved.savedAt.replace("T", " ").replace(/\.\d+Z$/, " UTC")}.
                {saved.model ? ` Started with ${saved.model}; may include your edits.` : " Manually written draft."}
              </p>
            )}

            {(text.trim() || dirty) && (
              <label className="location-option">
                <input
                  type="checkbox"
                  checked={allowReplace}
                  onChange={(event) => setAllowReplace(event.target.checked)}
                />
                Allow replacing the editor text when generating again or reopening. The saved draft changes only when I save.
              </label>
            )}

            <div className="action-row">
              <button
                className={text.trim() ? undefined : "button-primary"}
                type="button"
                onClick={generate}
                disabled={!hasDescription || !question.trim() || Boolean(text.trim() && !allowReplace)}
              >
                {pending ? "Working…" : text.trim() ? "Generate again with ChatGPT" : "Generate with ChatGPT"}
              </button>

              <button className={dirty ? "button-primary" : undefined} type="button" onClick={save} disabled={!dirty || !question.trim() || !text.trim()}>
                Save changes
              </button>

              <button type="button" disabled={!text.trim()} onClick={copy}>
                Copy draft
              </button>

              <button className="button-ghost" type="button" onClick={open} disabled={dirty && !allowReplace}>
                Reopen saved draft
              </button>
            </div>
          </fieldset>

          {!hasDescription && (
            <p className="muted">
              Advertisement text is required for generation. You can still edit and save a draft manually.
            </p>
          )}
        </>
      )}

      <div aria-live="polite">
        {pending && loaded && <p className="status status-running">Working… Your saved draft stays unchanged until a save succeeds.</p>}
        {message && <p className="status status-success">{message}</p>}
        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
    </section>
  );
}
