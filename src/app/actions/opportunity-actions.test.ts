import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import Database from "better-sqlite3";
import { listOpportunities } from "../../lib/opportunities.ts";
import { getEvaluation, saveEvaluation } from "../../lib/opportunity-evaluations.ts";
import { searchOpportunities } from "./opportunity-actions.ts";

const migration = readFileSync(new URL("../../../migrations/001-create-opportunities.sql", import.meta.url), "utf8");
const locationMigration = readFileSync(new URL("../../../migrations/002-add-opportunity-location.sql", import.meta.url), "utf8");
const evaluationMigration = readFileSync(new URL("../../../migrations/003-create-opportunity-evaluations.sql", import.meta.url), "utf8");
const liveEvaluationMigration = readFileSync(new URL("../../../migrations/004-enable-live-opportunity-evaluations.sql", import.meta.url), "utf8");
const advertisement = {
  id: "example-001", headline: "Example Developer", webpage_url: "https://example.test/jobs/001",
  description: { text: "Example advertisement text." },
  publication_date: "2026-10-21T10:30:00", application_deadline: "2026-11-30T23:59:59",
  workplace_address: { municipality: "Stockholm" },
};

function createFixture(t: TestContext) {
  const originalDirectory = process.cwd();
  const directory = mkdtempSync(join(tmpdir(), "job-actions-"));
  // Node's test runner isolates this file in its own process; tests run sequentially.
  t.after(() => {
    process.chdir(originalDirectory);
    assert.equal(dirname(directory), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  });
  mkdirSync(join(directory, "data"));
  const path = join(directory, "data", "app.sqlite");
  const db = new Database(path);
  try { db.exec(migration); db.exec(locationMigration); db.exec(evaluationMigration); db.exec(liveEvaluationMigration); } finally { db.close(); }
  process.chdir(directory);
  return path;
}

function searchForm(query = "developer", municipalities: string[] = []) {
  const form = new FormData();
  form.set("query", query);
  for (const municipality of municipalities) form.append("municipality", municipality);
  return form;
}

test("searches all selected areas from form data, saves results, and preserves duplicates", async (t) => {
  const path = createFixture(t);
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("q"), "developer");
    assert.deepEqual(url.searchParams.getAll("municipality"), ["example-area-001", "example-area-002"]);
    return Response.json({ total: { value: 1 }, hits: [advertisement] });
  });
  const first = await searchOpportunities(null, searchForm("developer", ["example-area-001", "example-area-002"]));
  assert.equal(first.status, "success");
  const repeated = await searchOpportunities(first, searchForm("developer", ["example-area-001", "example-area-002"]));
  assert.deepEqual(repeated, first);
  const db = new Database(path, { readonly: true, fileMustExist: true });
  try {
    const saved = listOpportunities(db);
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.publishedAt, advertisement.publication_date);
    assert.equal(saved[0]?.applicationDeadline, advertisement.application_deadline);
    assert.equal(saved[0]?.location, "Stockholm");
    if (first.status === "success") assert.deepEqual(first.opportunities, saved);
  } finally { db.close(); }
});

test("rejects blank or non-text form fields before searching", async (t) => {
  createFixture(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not fetch"); });
  const blank = await searchOpportunities(null, searchForm(" \t "));
  assert.equal(blank.status, "error");
  const file = searchForm();
  file.set("query", new Blob(["developer"]), "query.txt");
  assert.equal((await searchOpportunities(null, file)).status, "error");
  const invalidLocation = searchForm("developer", ["example-valid-area"]);
  invalidLocation.append("municipality", new Blob(["location"]), "location.txt");
  assert.equal((await searchOpportunities(null, invalidLocation)).status, "error");
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("rediscovery fills an older record's missing location without replacing its saved advertisement", async (t) => {
  const path = createFixture(t);
  const db = new Database(path);
  try {
    db.prepare(`INSERT INTO opportunities (source, source_id, title, url, discovered_at)
      VALUES (?, ?, ?, ?, ?)`).run(
      "platsbanken", advertisement.id, "Original title", "https://example.test/saved", "2026-10-01T12:00:00.000Z"
    );
  } finally { db.close(); }
  t.mock.method(globalThis, "fetch", async () => Response.json({ total: { value: 1 }, hits: [advertisement] }));
  const result = await searchOpportunities(null, searchForm());
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.opportunities[0]?.location, "Stockholm");
    assert.equal(result.opportunities[0]?.title, "Original title");
    assert.equal(result.opportunities[0]?.url, "https://example.test/saved");
    assert.equal(result.opportunities[0]?.discoveredAt, "2026-10-01T12:00:00.000Z");
  }
});

test("returns a helpful search error and accepts a valid empty search", async (t) => {
  createFixture(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 }));
  assert.deepEqual(await searchOpportunities(null, searchForm()), {
    status: "error", message: "Could not search Platsbanken. Please try again.",
  });
  fetchMock.mock.mockImplementation(async (input: string | URL | Request) => {
    assert.equal(new URL(String(input)).searchParams.has("municipality"), false);
    return Response.json({ total: { value: 0 }, hits: [] });
  });
  assert.deepEqual(await searchOpportunities(null, searchForm()), {
    status: "success", total: 0, skippedCount: 0, opportunities: [], nextOffset: null, limitReached: false,
    criteria: { query: "developer", municipalities: [] }, offset: 0,
  });
});

test("loads later search pages, preserves earlier saved ads and evaluations, and can retry a failed page", async (t) => {
  const path = createFixture(t);
  const offsets: number[] = [];
  let failPage = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const offset = Number(url.searchParams.get("offset"));
    offsets.push(offset);
    assert.equal(url.searchParams.get("q"), "developer");
    assert.deepEqual(url.searchParams.getAll("municipality"), ["example-area-001", "example-area-002"]);
    if (failPage) return new Response(null, { status: 503 });
    return Response.json({ total: { value: 22 }, hits: offset === 0
      ? Array.from({ length: 20 }, (_, index) => ({ ...advertisement, id: `example-${index}` }))
      : [{ ...advertisement, id: "example-0" }, { ...advertisement, id: "example-21" }] });
  });
  const first = await searchOpportunities(null, searchForm("developer", ["example-area-001", "example-area-002"]));
  assert.equal(first.status, "success");
  if (first.status !== "success") return;
  assert.equal(first.nextOffset, 20);
  const db = new Database(path);
  let saved;
  try {
    saved = saveEvaluation(db, first.opportunities[0].id, {
      recommendation: "worth_considering", summary: "Synthetic saved evaluation.", supportingEvidence: [], gapsAndUnknowns: [],
    }, { mode: "live", model: "gpt-6.1-sol" });
  } finally { db.close(); }

  const more = searchForm(first.criteria.query, first.criteria.municipalities);
  more.set("offset", String(first.nextOffset));
  failPage = true;
  assert.equal((await searchOpportunities(first, more)).status, "error");
  failPage = false;
  const second = await searchOpportunities(first, more);
  assert.equal(second.status, "success");
  if (second.status !== "success") return;
  assert.deepEqual(second.criteria, first.criteria);
  assert.equal(second.offset, 20);
  assert.equal(second.nextOffset, null);
  assert.equal(second.opportunities.length, 2);
  assert.deepEqual(second.evaluations, { [saved.opportunityId]: saved });
  const reopened = new Database(path, { readonly: true });
  try {
    assert.equal(listOpportunities(reopened, 100).length, 21);
    assert.deepEqual(getEvaluation(reopened, saved.opportunityId), saved);
  } finally { reopened.close(); }
  assert.deepEqual(offsets, [0, 20, 20]);
});

test("rejects malformed or out-of-range page offsets before any search or database changes", async (t) => {
  const path = createFixture(t);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Must not fetch"); });
  for (const offset of ["-1", "1.5", "2001", "", "not-a-number", "Infinity"]) {
    const form = searchForm();
    form.set("offset", offset);
    assert.equal((await searchOpportunities(null, form)).status, "error");
  }
  const file = searchForm();
  file.set("offset", new Blob(["20"]), "offset.txt");
  assert.equal((await searchOpportunities(null, file)).status, "error");
  assert.equal(fetchMock.mock.callCount(), 0);
  const db = new Database(path, { readonly: true });
  try { assert.deepEqual(listOpportunities(db), []); } finally { db.close(); }
});

test("rolls back the whole search when saving one advertisement fails", async (t) => {
  const path = createFixture(t);
  const db = new Database(path);
  try {
    db.exec(`CREATE TRIGGER fail_save BEFORE INSERT ON opportunities
      WHEN NEW.source_id = 'example-failing'
      BEGIN SELECT RAISE(ABORT, 'Simulated database failure'); END;`);
  } finally { db.close(); }
  t.mock.method(globalThis, "fetch", async () => Response.json({
    total: { value: 2 }, hits: [advertisement, { ...advertisement, id: "example-failing" }],
  }));
  const result = await searchOpportunities(null, searchForm());
  assert.equal(result.status, "error");
  if (result.status === "error") assert.match(result.message, /could not be saved/);
  const reopened = new Database(path, { readonly: true, fileMustExist: true });
  try { assert.deepEqual(listOpportunities(reopened), []); } finally { reopened.close(); }
});

test("returns saved evaluations when an opportunity is found again", async (t) => {
  const path = createFixture(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ total: { value: 1 }, hits: [advertisement] }));
  const first = await searchOpportunities(null, searchForm());
  assert.equal(first.status, "success");
  if (first.status !== "success") return;
  const db = new Database(path);
  let saved;
  try {
    saved = saveEvaluation(db, first.opportunities[0].id, {
      recommendation: "needs_clarification", summary: "Simulated result.", supportingEvidence: [], gapsAndUnknowns: ["Sample only."],
    });
  } finally { db.close(); }
  const repeated = await searchOpportunities(null, searchForm());
  assert.equal(repeated.status, "success");
  if (repeated.status === "success") assert.deepEqual(repeated.evaluations, { [saved.opportunityId]: saved });
});

test("evaluation setup failure leaves discovery and saved advertisements usable", async (t) => {
  const path = createFixture(t);
  const db = new Database(path);
  try { db.exec("DROP TABLE opportunity_evaluations"); } finally { db.close(); }
  t.mock.method(globalThis, "fetch", async () => Response.json({ total: { value: 1 }, hits: [advertisement] }));
  const result = await searchOpportunities(null, searchForm());
  assert.equal(result.status, "success");
  if (result.status === "success") {
    assert.equal(result.opportunities.length, 1);
    assert.match(result.evaluationError ?? "", /db:migrate/);
  }
  const reopened = new Database(path);
  try { assert.equal(listOpportunities(reopened).length, 1); } finally { reopened.close(); }
});
