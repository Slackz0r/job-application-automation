import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import Database from "better-sqlite3";
import { getTracking, getTrackingDetails, getTrackingMap, listTrackedOpportunities, saveTracking, TrackingConflictError } from "../../src/lib/opportunity-tracking.ts";
import { loadTrackedOpportunities, openTracking, saveOpportunityTracking } from "../../src/app/actions/tracking-actions.ts";
import { getOpportunity, saveOpportunity } from "../../src/lib/opportunities.ts";
import { getEvaluation, saveEvaluation } from "../../src/lib/opportunity-evaluations.ts";
import { getDraft, saveDraft } from "../../src/lib/application-drafts.ts";
import type { TrackingFilter, TrackingInput } from "../../src/schemas/opportunity-tracking.ts";

const migrations = ["001-create-opportunities.sql", "002-add-opportunity-location.sql", "003-create-opportunity-evaluations.sql", "004-enable-live-opportunity-evaluations.sql", "005-create-application-drafts.sql", "006-create-opportunity-tracking.sql"]
  .map((name) => readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
const value: TrackingInput = { status: "interested", appliedOn: null, notes: "A promising example role." };

function fixture(t: TestContext, count = 2) {
  const original = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "opportunity-tracking-"));
  t.after(() => { process.chdir(original); assert.equal(dirname(directory), resolve(tmpdir())); rmSync(directory, { recursive: true, force: true }); });
  mkdirSync(join(directory, "data"));
  const path = join(directory, "data", "app.sqlite");
  const db = new Database(path);
  const ids: number[] = [];
  try {
    for (const sql of migrations) db.exec(sql);
    for (let index = 0; index < count; index++) ids.push(saveOpportunity(db, {
      source: "example", sourceId: String(index), title: `Example role ${index}`, description: "Example ad text.", url: `https://example.test/${index}`,
    }).id);
  } finally { db.close(); }
  process.chdir(directory);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not contact a service"); });
  t.after(() => assert.equal(fetchMock.mock.callCount(), 0));
  return { path, ids, id: ids[0] };
}

test("untracked ads stay To review without writes; manual statuses and dates persist across reopening", async (t) => {
  const f = fixture(t);
  const first = await openTracking(f.id);
  assert.equal(first.status, "success");
  if (first.status !== "success") return;
  assert.equal(first.details.tracking.status, "to_review");
  assert.equal(first.details.tracking.revision, 0);
  assert.deepEqual(first.details.history, []);
  assert.equal((await loadTrackedOpportunities()).status, "success");
  const db = new Database(f.path);
  try {
    assert.equal(listTrackedOpportunities(db).total, 0);
    const interested = saveTracking(db, f.id, value, 0);
    const applied = saveTracking(db, f.id, { ...value, status: "applied", appliedOn: "2026-10-21" }, interested.tracking.revision);
    const interview = saveTracking(db, f.id, { ...value, status: "interview", appliedOn: applied.tracking.appliedOn }, applied.tracking.revision);
    const closed = saveTracking(db, f.id, { ...value, status: "closed", appliedOn: interview.tracking.appliedOn, notes: "Role filled." }, interview.tracking.revision);
    assert.equal(closed.tracking.appliedOn, "2026-10-21");
    assert.equal(closed.historyCount, 4);
    assert.deepEqual(closed.history.map((entry) => [entry.fromStatus, entry.toStatus]), [
      ["interview", "closed"], ["applied", "interview"], ["interested", "applied"], ["to_review", "interested"],
    ]);
    assert.equal(closed.history.some((entry) => entry.toStatus === "interview"), true);
    assert.ok(closed.history.every((entry) => entry.changedAt.endsWith("Z")));
    assert.notEqual(closed.history[0].changedAt.slice(0, 10), "2026-10-21");
  } finally { db.close(); }
  const reopened = await openTracking(f.id);
  assert.equal(reopened.status, "success");
  if (reopened.status === "success") assert.equal(reopened.details.tracking.status, "closed");
});

test("notes and date corrections do not create status events, and repeated saves are no-ops", (t) => {
  const f = fixture(t);
  const db = new Database(f.path);
  try {
    const empty = saveTracking(db, f.id, { status: "to_review", notes: "", appliedOn: null }, 0);
    assert.equal(empty.tracking.revision, 0);
    assert.equal(listTrackedOpportunities(db).total, 0);
    const notes = saveTracking(db, f.id, { status: "to_review", notes: "Question for recruiter.", appliedOn: null }, 0);
    assert.equal(notes.historyCount, 0);
    const applied = saveTracking(db, f.id, { ...value, status: "applied", appliedOn: null }, 1);
    assert.equal(applied.tracking.appliedOn, null); // An unknown date is not invented by the server.
    const corrected = saveTracking(db, f.id, { ...value, status: "applied", appliedOn: "2026-10-20", notes: "Corrected application date." }, 2);
    assert.equal(corrected.historyCount, 1);
    assert.deepEqual(saveTracking(db, f.id, { status: corrected.tracking.status, notes: corrected.tracking.notes, appliedOn: corrected.tracking.appliedOn }, 3), corrected);
    assert.deepEqual(getTrackingMap(db, [f.id]), { [f.id]: corrected.tracking });
  } finally { db.close(); }
});

test("stale first saves and stale edits cannot overwrite newer tracking or append history", (t) => {
  const f = fixture(t);
  const db = new Database(f.path);
  try {
    const first = saveTracking(db, f.id, value, 0);
    assert.throws(() => saveTracking(db, f.id, { ...value, status: "skipped" }, 0), TrackingConflictError);
    const latest = saveTracking(db, f.id, { ...value, status: "applied" }, 1);
    assert.throws(() => saveTracking(db, f.id, { ...value, status: "offer" }, first.tracking.revision), TrackingConflictError);
    assert.deepEqual(getTrackingDetails(db, f.id), latest);
  } finally { db.close(); }
});

test("a history write failure rolls back the status, date, notes and revision together", (t) => {
  const f = fixture(t);
  const db = new Database(f.path);
  try {
    const first = saveTracking(db, f.id, value, 0);
    db.exec("CREATE TRIGGER fail_history BEFORE INSERT ON opportunity_status_history BEGIN SELECT RAISE(ABORT, 'SYNTHETIC PRIVATE DETAIL'); END");
    assert.throws(() => saveTracking(db, f.id, { status: "applied", appliedOn: "2026-10-20", notes: "Must roll back." }, 1));
    assert.deepEqual(getTrackingDetails(db, f.id), first);
  } finally { db.close(); }
});

test("filters and pagination reach old saved ads and retain all status events beyond the displayed history", (t) => {
  const f = fixture(t, 45);
  const db = new Database(f.path);
  try {
    const first = listTrackedOpportunities(db, "to_review");
    const second = listTrackedOpportunities(db, "to_review", first.nextOffset!);
    const third = listTrackedOpportunities(db, "to_review", second.nextOffset!);
    assert.equal(first.total, 45);
    assert.equal(first.items.length, 20);
    assert.equal(second.items.length, 20);
    assert.equal(third.items.length, 5);
    assert.equal(third.nextOffset, null);
    assert.equal(new Set([...first.items, ...second.items, ...third.items].map((item) => item.opportunity.id)).size, 45);
    saveTracking(db, f.ids[1], { ...value, status: "skipped" }, 0);
    for (let revision = 0; revision < 30; revision++) {
      saveTracking(db, f.id, { ...value, status: revision % 2 === 0 ? "interested" : "interview" }, revision);
    }
    assert.equal(listTrackedOpportunities(db).total, 2);
    assert.equal(listTrackedOpportunities(db, "to_review").total, 43);
    assert.equal(listTrackedOpportunities(db, "skipped").items[0].opportunity.id, f.ids[1]);
    assert.equal(listTrackedOpportunities(db, "offer").total, 0);
    const history = getTrackingDetails(db, f.id);
    assert.equal(history.historyCount, 30);
    assert.equal(history.history.length, 25);
  } finally { db.close(); }
});

test("tracking and rediscovery preserve saved advertisements, evaluations and application drafts", (t) => {
  const f = fixture(t);
  const db = new Database(f.path);
  try {
    const ad = getOpportunity(db, f.id)!;
    const draft = saveDraft(db, f.id, { question: "Example question", text: "Applicant edits.", model: null }, 0);
    const evaluation = saveEvaluation(db, f.id, { recommendation: "worth_considering", summary: "Example evaluation.", supportingEvidence: [], gapsAndUnknowns: [] });
    const saved = saveTracking(db, f.id, value, 0);
    saveOpportunity(db, { ...ad, title: "Changed source title", description: "Changed source text" });
    assert.deepEqual(getOpportunity(db, f.id), ad);
    assert.deepEqual(getEvaluation(db, f.id), evaluation);
    assert.deepEqual(getDraft(db, f.id), draft);
    assert.deepEqual(getTracking(db, f.id), saved.tracking);
    assert.equal(getTracking(db, f.ids[1]).status, "to_review");
  } finally { db.close(); }
});

test("actions validate input and leave tracking available without a profile, sign-in or live requests", async (t) => {
  const f = fixture(t);
  for (const bad of [{ ...value, status: "invented" }, { ...value, notes: "x".repeat(6001) }, { ...value, appliedOn: "2026-02-30" }, { ...value, appliedOn: "" }]) {
    assert.equal((await saveOpportunityTracking(f.id, bad as TrackingInput, 0)).status, "error");
  }
  assert.equal((await saveOpportunityTracking(f.id, value, -1)).status, "error");
  assert.equal((await saveOpportunityTracking(0, value, 0)).status, "error");
  assert.equal((await saveOpportunityTracking(999, value, 0)).status, "error");
  assert.equal((await openTracking(999)).status, "error");
  assert.equal((await loadTrackedOpportunities("invalid" as TrackingFilter)).status, "error");
  assert.equal((await loadTrackedOpportunities("tracked", -1)).status, "error");
  const saved = await saveOpportunityTracking(f.id, value, 0);
  assert.equal(saved.status, "success");
  const stale = await saveOpportunityTracking(f.id, value, 0);
  assert.equal(stale.status, "error");
  if (stale.status === "error") assert.match(stale.message, /changed elsewhere/);
  const db = new Database(f.path);
  try { db.exec("DROP TABLE opportunity_evaluations"); } finally { db.close(); }
  const list = await loadTrackedOpportunities();
  assert.equal(list.status, "success");
  if (list.status === "success") {
    assert.equal(list.page.items.length, 1);
    assert.match(list.page.evaluationError!, /evaluations/);
  }
});
