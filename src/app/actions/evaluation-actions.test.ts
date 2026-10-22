import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import Database from "better-sqlite3";
import { evaluateOpportunity } from "./evaluation-actions.ts";
import { saveOpportunity } from "../../lib/opportunities.ts";
import { getEvaluation, saveEvaluation } from "../../lib/opportunity-evaluations.ts";

const example = readFileSync(new URL("../../../professional-profile.example.json", import.meta.url), "utf8");
const migrations = ["001-create-opportunities.sql", "002-add-opportunity-location.sql", "003-create-opportunity-evaluations.sql"]
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
  return { path, profilePath, id, noTextId };
}

test("saves a simulation and reuses it on repeat requests without needing to load the profile again", async (t) => {
  const { path, profilePath, id } = createFixture(t);
  const result = await evaluateOpportunity(id, null, new FormData());
  assert.equal(result.status, "success");
  if (result.status !== "success") return;
  assert.equal(result.evaluation.mode, "simulated");
  unlinkSync(profilePath);
  assert.deepEqual(await evaluateOpportunity(id, null, new FormData()), result);
  const reopened = new Database(path, { fileMustExist: true });
  try { assert.deepEqual(getEvaluation(reopened, id), result.evaluation); } finally { reopened.close(); }
});

test("an explicit rerun replaces the result, while failed reruns preserve the saved result", async (t) => {
  const { path, id } = createFixture(t);
  const first = await evaluateOpportunity(id, null, new FormData());
  assert.equal(first.status, "success");
  if (first.status !== "success") return;
  const db = new Database(path);
  try { saveEvaluation(db, id, { ...first.evaluation.result, summary: "Previous sample." }); } finally { db.close(); }
  const form = new FormData();
  form.set("reevaluate", "true");
  const rerun = await evaluateOpportunity(id, null, form);
  assert.equal(rerun.status, "success");
  if (rerun.status !== "success") return;
  assert.notEqual(rerun.evaluation.result.summary, "Previous sample.");
  const failing = new Database(path);
  try {
    failing.exec("CREATE TRIGGER fail_update BEFORE UPDATE ON opportunity_evaluations BEGIN SELECT RAISE(ABORT, 'PRIVATE DATABASE DETAIL'); END;");
  } finally { failing.close(); }
  const failure = await evaluateOpportunity(id, null, form);
  assert.equal(failure.status, "error");
  assert.doesNotMatch(JSON.stringify(failure), /PRIVATE DATABASE DETAIL/);
  const reopened = new Database(path, { fileMustExist: true });
  try { assert.deepEqual(getEvaluation(reopened, id), rerun.evaluation); } finally { reopened.close(); }
});

test("handles missing jobs, text, and invalid or unavailable profiles without exposing their contents", async (t) => {
  const { path, profilePath, id, noTextId } = createFixture(t);
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
  const db = new Database(path);
  try { assert.equal(getEvaluation(db, id), null); } finally { db.close(); }
});

test("reports missing evaluation migrations without writing partial results", async (t) => {
  const { path, id } = createFixture(t);
  const db = new Database(path);
  try { db.exec("DROP TABLE opportunity_evaluations"); } finally { db.close(); }
  const result = await evaluateOpportunity(id, null, new FormData());
  assert.equal(result.status, "error");
  if (result.status === "error") assert.match(result.message, /db:migrate/);
});
