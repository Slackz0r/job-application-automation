import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import Database from "better-sqlite3";
import { ZodError } from "zod";
import { getOpportunity, listOpportunities, saveOpportunity } from "./opportunities.ts";

const initialMigration = readFileSync(
  new URL("../../migrations/001-create-opportunities.sql", import.meta.url),
  "utf8",
);
const locationMigration = readFileSync(new URL("../../migrations/002-add-opportunity-location.sql", import.meta.url), "utf8");

const example = {
  source: "example-source",
  sourceId: "job-001",
  title: "Example Developer",
  url: "https://example.test/jobs/001",
};

function createFixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), "job-opportunities-"));
  const path = join(directory, "app.sqlite");
  const db = new Database(path);
  t.after(() => {
    if (db.open) db.close();
    assert.equal(dirname(directory), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  });
  db.exec(initialMigration);
  db.exec(locationMigration);
  return { db, path };
}

test("saves useful minimum data, generates discovery time, and survives reopening", (t) => {
  const { db, path } = createFixture(t);
  const before = Date.now();
  const saved = saveOpportunity(db, {
    ...example,
    source: "  example-source  ",
    title: "  Example Developer\n",
    discoveredAt: "2000-01-01T00:00:00.000Z",
  });
  assert.ok(saved.id > 0);
  assert.ok(Date.parse(saved.discoveredAt) >= before);
  assert.ok(Date.parse(saved.discoveredAt) <= Date.now());
  assert.deepEqual(saved, {
    ...example,
    id: saved.id,
    discoveredAt: saved.discoveredAt,
    company: null,
    location: null,
    description: null,
    applicationDeadline: null,
    publishedAt: null,
  });
  db.close();

  const reopened = new Database(path, { fileMustExist: true });
  try {
    assert.deepEqual(getOpportunity(reopened, saved.id), saved);
    assert.equal(getOpportunity(reopened, saved.id + 1), null);
  } finally {
    reopened.close();
  }
});

test("preserves advertisement text and optional dates, and treats blank optional text as unknown", (t) => {
  const { db } = createFixture(t);
  const details = {
    ...example,
    title: "Developer's role; DROP TABLE opportunities; --",
    company: "  Example Company  ",
    location: "  Stockholm  ",
    description: "  First paragraph.\n\nSecond paragraph.  ",
    applicationDeadline: "2026-11-30",
    publishedAt: "2026-10-21T10:30:00+02:00",
  };
  const saved = saveOpportunity(db, details);
  assert.deepEqual(getOpportunity(db, saved.id), {
    ...details,
    company: "Example Company",
    location: "Stockholm",
    description: "First paragraph.\n\nSecond paragraph.",
    id: saved.id,
    discoveredAt: saved.discoveredAt,
  });
  const minimal = saveOpportunity(db, {
    ...example,
    sourceId: "job-002",
    company: " \t\n ",
    location: " \t ",
    description: null,
    applicationDeadline: null,
    publishedAt: null,
  });
  assert.equal(minimal.company, null);
  assert.equal(minimal.location, null);
  assert.equal(minimal.description, null);
});

test("returns the original opportunity for duplicates without overwriting any fields", (t) => {
  const { db } = createFixture(t);
  const first = saveOpportunity(db, { ...example, location: "Stockholm" });
  const duplicate = saveOpportunity(db, {
    ...example,
    title: "Changed title",
    url: "https://example.test/changed",
    description: "Changed description",
    location: "Solna",
  });
  assert.deepEqual(duplicate, first);
  const otherSource = saveOpportunity(db, { ...example, source: "another-source" });
  assert.notEqual(otherSource.id, first.id);
  assert.deepEqual(db.prepare("SELECT COUNT(*) AS count FROM opportunities").get(), { count: 2 });
});

test("fills a missing location on rediscovery while preserving all other saved fields", (t) => {
  const { db, path } = createFixture(t);
  const first = saveOpportunity(db, example);
  const filled = saveOpportunity(db, {
    ...example, title: "Changed title", description: "Changed text", location: "Stockholm",
  });
  assert.deepEqual(filled, { ...first, location: "Stockholm" });
  assert.deepEqual(saveOpportunity(db, { ...example, location: "Solna" }), filled);
  assert.deepEqual(saveOpportunity(db, example), filled);
  db.close();
  const reopened = new Database(path, { readonly: true, fileMustExist: true });
  try { assert.deepEqual(getOpportunity(reopened, first.id), filled); } finally { reopened.close(); }
});

test("preserves source timestamps without adding or converting a timezone", (t) => {
  const { db, path } = createFixture(t);
  const saved = saveOpportunity(db, {
    ...example,
    publishedAt: "2026-10-21T10:30:00",
    applicationDeadline: "2026-11-30T23:59:59",
  });
  db.close();
  const reopened = new Database(path, { fileMustExist: true });
  try {
    const loaded = getOpportunity(reopened, saved.id);
    assert.equal(loaded?.publishedAt, "2026-10-21T10:30:00");
    assert.equal(loaded?.applicationDeadline, "2026-11-30T23:59:59");
    assert.match(saved.discoveredAt, /Z$/);
  } finally {
    reopened.close();
  }
});

test("rejects incomplete or invalid advertisements before saving anything", (t) => {
  const { db } = createFixture(t);
  for (const field of ["source", "sourceId", "title", "url"]) {
    for (const value of [undefined, null, "", " \t\r\n ", 123]) {
      assert.throws(() => saveOpportunity(db, { ...example, [field]: value }), ZodError);
    }
  }
  for (const url of ["/jobs/001", "not-a-url", "javascript:alert(1)", "ftp://example.test/job"]) {
    assert.throws(() => saveOpportunity(db, { ...example, url }), ZodError);
  }
  for (const field of ["applicationDeadline", "publishedAt"]) {
    for (const value of ["", "tomorrow", "2026-02-30", "2026-02-30T10:30:00", "2026-10-21T25:30:00", 123]) {
      assert.throws(() => saveOpportunity(db, { ...example, [field]: value }), ZodError);
    }
  }
  assert.deepEqual(db.prepare("SELECT COUNT(*) AS count FROM opportunities").get(), { count: 0 });
});

test("rejects invalid internal IDs", (t) => {
  const { db } = createFixture(t);
  for (const id of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => getOpportunity(db, id), ZodError);
  }
});

test("lists the most recently discovered opportunities with a predictable limit", (t) => {
  const { db } = createFixture(t);
  assert.deepEqual(listOpportunities(db), []);
  const first = saveOpportunity(db, example);
  const second = saveOpportunity(db, { ...example, sourceId: "job-002" });
  db.prepare("UPDATE opportunities SET discovered_at = ?").run("2026-10-21T12:00:00.000Z");
  assert.deepEqual(listOpportunities(db, 1).map((opportunity) => opportunity.id), [second.id]);
  assert.deepEqual(listOpportunities(db).map((opportunity) => opportunity.id), [second.id, first.id]);
  db.prepare("UPDATE opportunities SET discovered_at = ? WHERE id = ?").run("2026-10-22T12:00:00.000Z", first.id);
  assert.equal(listOpportunities(db, 1)[0]?.id, first.id);
});
