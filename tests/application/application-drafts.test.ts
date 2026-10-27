import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import Database from "better-sqlite3";
import { DraftConflictError, getDraft, saveDraft } from "../../src/lib/application-drafts.ts";
import { generateForOpportunity, loadApplicationDraft, saveApplicationText, type ApplicationInput } from "../../src/lib/application-generation.ts";
import { saveOpportunity } from "../../src/lib/opportunities.ts";
import { getEvaluation, saveEvaluation } from "../../src/lib/opportunity-evaluations.ts";
import type { GeneratedDraftState } from "../../src/schemas/application-draft.ts";

const example = readFileSync(new URL("../../professional-profile.example.json", import.meta.url), "utf8");
const migrations = ["001-create-opportunities.sql", "002-add-opportunity-location.sql", "003-create-opportunity-evaluations.sql", "004-enable-live-opportunity-evaluations.sql", "005-create-application-drafts.sql"]
  .map((name) => readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
const content = { question: "Motivera din relevanta erfarenhet.", text: "Jag har levererat responsiva webbgränssnitt.", model: "gpt-6.1-sol" as const };

function fixture(t: TestContext) {
  const original = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "application-drafts-"));
  t.after(() => { process.chdir(original); assert.equal(dirname(directory), resolve(tmpdir())); rmSync(directory, { recursive: true, force: true }); });
  mkdirSync(join(directory, "data"));
  const profilePath = join(directory, "professional-profile.json");
  const profile = JSON.parse(example);
  profile.personalityAndInterests = { privateMarker: "EXCLUDED PERSONAL MARKER" };
  profile.extraPrivate = "EXCLUDED TOP LEVEL MARKER";
  writeFileSync(profilePath, JSON.stringify(profile));
  const path = join(directory, "data", "app.sqlite");
  const db = new Database(path);
  let id: number;
  let noTextId: number;
  try {
    for (const sql of migrations) db.exec(sql);
    const job = { source: "example", sourceId: "001", title: "Example Developer", description: "Build accessible interfaces.", url: "https://example.test/job" };
    id = saveOpportunity(db, job).id;
    noTextId = saveOpportunity(db, { ...job, sourceId: "002", description: null }).id;
  } finally { db.close(); }
  process.chdir(directory);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not contact a live service"); });
  t.after(() => assert.equal(fetchMock.mock.callCount(), 0));
  const generate = t.mock.fn(async (input: ApplicationInput): Promise<GeneratedDraftState> => ({
    status: "success", draft: { ...content, question: input.question },
  }));
  return { path, profilePath, id, noTextId, generate };
}

test("saves and reopens one draft, preserves evaluations and rejects stale saves from another tab", (t) => {
  const f = fixture(t);
  const first = saveApplicationText(f.id, content, 0);
  assert.equal(first.status, "success");
  if (first.status !== "success" || !first.draft) return;
  const db = new Database(f.path);
  try {
    const evaluation = saveEvaluation(db, f.id, { recommendation: "worth_considering", summary: "Synthetic review.", supportingEvidence: [], gapsAndUnknowns: [] }, { mode: "live", model: "gpt-6.1-sol" });
    const edited = saveDraft(db, f.id, { ...content, text: "Text edited by the applicant." }, first.draft.revision);
    assert.equal(edited.revision, 2);
    assert.throws(() => saveDraft(db, f.id, content, 0), DraftConflictError);
    assert.throws(() => saveDraft(db, f.id, content, 1), DraftConflictError);
    assert.deepEqual(getDraft(db, f.id), edited);
    assert.deepEqual(getEvaluation(db, f.id), evaluation);
  } finally { db.close(); }
  const reopened = loadApplicationDraft(f.id);
  assert.equal(reopened.status, "success");
  if (reopened.status === "success") assert.equal(reopened.draft?.text, "Text edited by the applicant.");
  const stale = saveApplicationText(f.id, content, 1);
  assert.equal(stale.status, "error");
  if (stale.status === "error") assert.match(stale.message, /newer version.*editor text is unchanged/i);
});

test("generation uses approved evidence and returns an unsaved candidate without replacing existing edits", async (t) => {
  const f = fixture(t);
  const original = saveApplicationText(f.id, { ...content, text: "Existing applicant edits." }, 0);
  const result = await generateForOpportunity(f.id, "  A different employer question.  ", f.generate);
  assert.equal(result.status, "success");
  if (result.status === "success") assert.equal(result.draft.question, "A different employer question.");
  const sent = f.generate.mock.calls[0].arguments[0];
  assert.equal(sent.question, "A different employer question.");
  assert.equal(sent.opportunity.description, "Build accessible interfaces.");
  assert.doesNotMatch(JSON.stringify(sent), /EXCLUDED|personalityAndInterests|extraPrivate/);
  assert.deepEqual(loadApplicationDraft(f.id), original);
  assert.equal(f.generate.mock.callCount(), 1);
});

test("failed or invalid generation leaves saved text intact and never retries", async (t) => {
  const f = fixture(t);
  const original = saveApplicationText(f.id, content, 0);
  for (const runner of [
    async (): Promise<GeneratedDraftState> => ({ status: "error", message: "Synthetic usage limit." }),
    async (): Promise<GeneratedDraftState> => ({ status: "success", draft: { ...content, text: " " } }),
    async (): Promise<GeneratedDraftState> => { throw new Error("PRIVATE PROVIDER DETAIL"); },
  ]) {
    const run = t.mock.fn(runner);
    const result = await generateForOpportunity(f.id, content.question, run);
    assert.equal(result.status, "error");
    assert.equal(run.mock.callCount(), 1);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE PROVIDER DETAIL/);
    assert.deepEqual(loadApplicationDraft(f.id), original);
  }
});

test("missing or invalid setup prevents generation while manual saving needs no profile or subscription", async (t) => {
  const f = fixture(t);
  assert.equal((await generateForOpportunity(0, content.question, f.generate)).status, "error");
  assert.equal((await generateForOpportunity(999, content.question, f.generate)).status, "error");
  assert.equal((await generateForOpportunity(f.noTextId, content.question, f.generate)).status, "error");
  for (const question of [" ", "x".repeat(3001), null, {}]) {
    assert.equal((await generateForOpportunity(f.id, question, f.generate)).status, "error");
  }
  unlinkSync(f.profilePath);
  assert.equal((await generateForOpportunity(f.id, content.question, f.generate)).status, "error");
  assert.equal(saveApplicationText(f.id, { ...content, model: null }, 0).status, "success");
  assert.equal(f.generate.mock.callCount(), 0);
  const db = new Database(f.path);
  try { db.exec("DROP TABLE application_drafts"); } finally { db.close(); }
  writeFileSync(f.profilePath, example);
  assert.equal((await generateForOpportunity(f.id, content.question, f.generate)).status, "error");
  assert.equal(loadApplicationDraft(f.id).status, "error");
  assert.equal(f.generate.mock.callCount(), 0);
});

test("invalid draft fields or revisions cannot replace a saved draft", (t) => {
  const f = fixture(t);
  const original = saveApplicationText(f.id, content, 0);
  for (const bad of [{ ...content, text: " " }, { ...content, question: " " }, { ...content, text: "x".repeat(12001) }, { ...content, model: "another-model" }]) {
    assert.equal(saveApplicationText(f.id, bad, 1).status, "error");
  }
  for (const revision of [-1, 1.5, NaN, Number.MAX_SAFE_INTEGER]) assert.equal(saveApplicationText(f.id, content, revision).status, "error");
  assert.deepEqual(loadApplicationDraft(f.id), original);
});
