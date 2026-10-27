import "server-only";

import type Database from "better-sqlite3";
import { draftContentSchema, draftIdSchema, draftRevisionSchema, savedDraftSchema, type SavedDraft } from "../schemas/application-draft.ts";

export class DraftConflictError extends Error {
  constructor() { super("A newer draft has been saved. Reopen the saved draft before replacing it."); }
}

export function getDraft(db: Database.Database, opportunityId: number): SavedDraft | null {
  draftIdSchema.parse(opportunityId);
  const row = db.prepare(`SELECT opportunity_id AS opportunityId, question, text, model, revision, saved_at AS savedAt
    FROM application_drafts WHERE opportunity_id = ?`).get(opportunityId);
  return row ? savedDraftSchema.parse(row) : null;
}

// Compare the loaded revision so another tab cannot silently replace newer edits.
export function saveDraft(db: Database.Database, opportunityId: number, input: unknown, expectedRevision: number): SavedDraft {
  draftIdSchema.parse(opportunityId);
  draftRevisionSchema.parse(expectedRevision);
  const content = draftContentSchema.parse(input);
  const draft = savedDraftSchema.parse({ ...content, opportunityId, revision: expectedRevision + 1, savedAt: new Date().toISOString() });
  const values = { ...draft, expectedRevision };
  const result = expectedRevision === 0
    ? db.prepare(`INSERT INTO application_drafts (opportunity_id, question, text, model, revision, saved_at)
        VALUES (@opportunityId, @question, @text, @model, @revision, @savedAt)
        ON CONFLICT (opportunity_id) DO NOTHING`).run(values)
    : db.prepare(`UPDATE application_drafts SET question = @question, text = @text, model = @model,
        revision = @revision, saved_at = @savedAt
        WHERE opportunity_id = @opportunityId AND revision = @expectedRevision`).run(values);
  if (result.changes !== 1) throw new DraftConflictError();
  return draft;
}
