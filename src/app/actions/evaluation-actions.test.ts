import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import Database from "better-sqlite3";
import { evaluateSavedOpportunity, type EvaluationInput } from "../../lib/opportunity-evaluation.ts";
import { evaluationModel, type LiveEvaluationState } from "../../schemas/opportunity-evaluation.ts";
import { saveOpportunity } from "../../lib/opportunities.ts";
import { getEvaluation, saveEvaluation } from "../../lib/opportunity-evaluations.ts";

const example = readFileSync(new URL("../../../professional-profile.example.json", import.meta.url), "utf8");
const migrations = ["001-create-opportunities.sql", "002-add-opportunity-location.sql", "003-create-opportunity-evaluations.sql", "004-enable-live-opportunity-evaluations.sql"]
  .map((name) => readFileSync(new URL(`../../../migrations/${name}`, import.meta.url), "utf8"));

function createFixture(t: TestContext) {
  const originalDirectory = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "evaluation-actions-"));
  t.after(() => {
    process.chdir(originalDirectory);
    assert.equal(dirname(directory), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  });
  mkdirSync(join(directory, "data"));
  const path = join(directory, "data", "app.sqlite");
  const profilePath = join(directory, "professional-profile.json");
  writeFileSync(profilePath, example);
  const db = new Database(path);
  let id: number;
  let noTextId: number;
  try {
    for (const migration of migrations) db.exec(migration);
    const job = { source: "example", sourceId: "001", title: "Example Developer", description: "Example advertisement text.", url: "https://example.test/job" };
    id = saveOpportunity(db, job).id;
    noTextId = saveOpportunity(db, { ...job, sourceId: "002", description: null }).id;
  } finally { db.close(); }
  process.chdir(directory);
  const fetchMock = t.mock.method(globalThis, "fetch", () => { throw new Error("Must not contact any service"); });
  t.after(() => assert.equal(fetchMock.mock.callCount(), 0));
  const runEvaluation = t.mock.fn(async (input: EvaluationInput): Promise<LiveEvaluationState> => {
    assert.ok(input.opportunity.description);
    return {
    status: "success", model: evaluationModel, result: {
      recommendation: "worth_considering", summary: "A synthetic evaluation for testing.",
      supportingEvidence: ["Example Organization: a documented web contribution is relevant."],
      gapsAndUnknowns: ["Dates are unknown."],
    },
    };
  });
  const evaluateOpportunity = (id: number, _state: unknown, form: FormData) => evaluateSavedOpportunity(id, form, runEvaluation);
  return { path, profilePath, id, noTextId, evaluateOpportunity, runEvaluation };
}

test("saves a live evaluation and reuses it on repeat requests without needing to load the profile again", async (t) => {
  const { path, profilePath, id, evaluateOpportunity, runEvaluation } = createFixture(t);
  const result = await evaluateOpportunity(id, null, new FormData());
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.evaluation.mode, "live");
  assert.equal(result.evaluation.model, evaluationModel);
  unlinkSync(profilePath);
  assert.deepEqual(await evaluateOpportunity(id, null, new FormData()), result);
  assert.equal(runEvaluation.mock.callCount(), 1);
  const reopened = new Database(path, { fileMustExist: true });
  try { assert.deepEqual(getEvaluation(reopened, id), result.evaluation); } finally { reopened.close(); }
});

test("an explicit rerun replaces the result, while failed reruns preserve the saved result", async (t) => {
  const { path, id, evaluateOpportunity, runEvaluation } = createFixture(t);
  const first = await evaluateOpportunity(id, null, new FormData());
  assert.equal(first.status, "success");
  if (first.status !== "success") return;
  const db = new Database(path);
  try { saveEvaluation(db, id, { ...first.evaluation.result, summary: "Previous saved result." }, { mode: "live", model: evaluationModel }); } finally { db.close(); }
  const form = new FormData();
  form.set("reevaluate", "true");
  const rerun = await evaluateOpportunity(id, null, form);
  assert.equal(rerun.status, "success");
  if (rerun.status !== "success") return;
  assert.notEqual(rerun.evaluation.result.summary, "Previous saved result.");
  const failing = new Database(path);
  try {
    failing.exec("CREATE TRIGGER fail_update BEFORE UPDATE ON opportunity_evaluations BEGIN SELECT RAISE(ABORT, 'PRIVATE DATABASE DETAIL'); END;");
  } finally { failing.close(); }
  const failure = await evaluateOpportunity(id, null, form);
  assert.equal(failure.status, "error");
  if (failure.status === "error") assert.match(failure.message, /request completed.*could not be saved/);
  assert.doesNotMatch(JSON.stringify(failure), /PRIVATE DATABASE DETAIL/);
  assert.equal(runEvaluation.mock.callCount(), 3);
  const reopened = new Database(path, { fileMustExist: true });
  try { assert.deepEqual(getEvaluation(reopened, id), rerun.evaluation); } finally { reopened.close(); }
});

test("handles missing jobs, text, and invalid or unavailable profiles without exposing their contents", async (t) => {
  const { path, profilePath, id, noTextId, evaluateOpportunity, runEvaluation } = createFixture(t);
  for (const invalidId of [0, -1, 1.5, Number.NaN, 999]) {
    assert.equal((await evaluateOpportunity(invalidId, null, new FormData())).status, "error");
  }
  const noText = await evaluateOpportunity(noTextId, null, new FormData());
  assert.equal(noText.status, "error");
  if (noText.status === "error") assert.match(noText.message, /advertisement text/);
  for (const content of ['{"PRIVATE PROFILE MARKER":', '{"privateNote":"PRIVATE PROFILE MARKER"}']) {
    writeFileSync(profilePath, content);
    const result = await evaluateOpportunity(id, null, new FormData());
    assert.equal(result.status, "error");
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE PROFILE MARKER/);
  }
  unlinkSync(profilePath);
  assert.equal((await evaluateOpportunity(id, null, new FormData())).status, "error");
  assert.equal(runEvaluation.mock.callCount(), 0);
  const db = new Database(path);
  try { assert.equal(getEvaluation(db, id), null); } finally { db.close(); }
});

test("reports missing evaluation migrations without writing partial results", async (t) => {
  const { path, id, evaluateOpportunity, runEvaluation } = createFixture(t);
  const db = new Database(path);
  try { db.exec("DROP TABLE opportunity_evaluations"); } finally { db.close(); }
  const result = await evaluateOpportunity(id, null, new FormData());
  assert.equal(result.status, "error");
  if (result.status === "error") assert.match(result.message, /db:migrate/);
  assert.equal(runEvaluation.mock.callCount(), 0);
});


test("replaces a saved sample with a real result only after a valid completed evaluation", async (t) => {
  const { path, id, evaluateOpportunity, runEvaluation } = createFixture(t);
  const db = new Database(path);
  const sample = saveEvaluation(db, id, {
    recommendation: "needs_clarification", summary: "Previous sample.", supportingEvidence: [], gapsAndUnknowns: [],
  });
  db.close();
  const failed = await evaluateSavedOpportunity(id, new FormData(), async () => ({ status: "error", message: "Incomplete response." }));
  assert.equal(failed.status, "error");
  const unchanged = new Database(path);
  try { assert.deepEqual(getEvaluation(unchanged, id), sample); } finally { unchanged.close(); }
  const result = await evaluateOpportunity(id, null, new FormData());
  assert.equal(result.status, "success");
  if (result.status === "success") assert.equal(result.evaluation.mode, "live");
  assert.equal(runEvaluation.mock.callCount(), 1);
  const input = runEvaluation.mock.calls[0].arguments[0];
  assert.equal(input.opportunity.description, "Example advertisement text.");
  assert.deepEqual(Object.keys(input.profile).sort(), ["careerPreferences", "experiences", "skillsAndCompetencies"]);
});

test("a failed live rerun preserves the previous result and requires another explicit attempt", async (t) => {
  const { path, id, evaluateOpportunity } = createFixture(t);
  const first = await evaluateOpportunity(id, null, new FormData());
  assert.equal(first.status, "success");
  if (first.status !== "success") return;
  const form = new FormData(); form.set("reevaluate", "true");
  let calls = 0;
  const failed = await evaluateSavedOpportunity(id, form, async () => {
    calls++;
    return { status: "error", message: "A usage limit was reached.", requestId: "synthetic-request" };
  });
  assert.equal(failed.status, "error");
  if (failed.status === "error") {
    assert.match(failed.message, /usage limit.*previous saved result is unchanged/);
    assert.equal(failed.requestId, "synthetic-request");
  }
  assert.equal(calls, 1);
  const db = new Database(path);
  try { assert.deepEqual(getEvaluation(db, id), first.evaluation); } finally { db.close(); }
});
