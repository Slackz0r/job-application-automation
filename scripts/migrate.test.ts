import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const runnerPath = fileURLToPath(new URL("./migrate.ts", import.meta.url));
const initialMigration = await readFile(
  new URL("../migrations/001-create-opportunities.sql", import.meta.url),
  "utf8"
);
const locationMigration = await readFile(
  new URL("../migrations/002-add-opportunity-location.sql", import.meta.url), "utf8"
);
const evaluationMigration = await readFile(new URL("../migrations/003-create-opportunity-evaluations.sql", import.meta.url), "utf8");
const liveEvaluationMigration = await readFile(new URL("../migrations/004-enable-live-opportunity-evaluations.sql", import.meta.url), "utf8");

async function createFixture(t: TestContext, migrations: Record<string, string>) {
  const directory = await mkdtemp(join(tmpdir(), "job-migrations-"));
  t.after(async () => {
    assert.equal(dirname(directory), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, "migrations"));
  for (const [name, sql] of Object.entries(migrations)) {
    await writeFile(join(directory, "migrations", name), sql);
  }
  return directory;
}

function runMigrations(directory: string) {
  return spawnSync(
    process.execPath,
    ["--conditions=react-server", runnerPath],
    { cwd: directory, encoding: "utf8", windowsHide: true }
  );
}

test("applies a migration once and preserves saved opportunities on repeat runs", async (t) => {
  const directory = await createFixture(t, {
    "001-create-opportunities.sql": initialMigration,
  });
  const firstRun = runMigrations(directory);
  assert.equal(firstRun.error, undefined);
  assert.equal(firstRun.status, 0, firstRun.stderr);
  assert.match(firstRun.stdout, /Applied: 001-create-opportunities\.sql/);

  const databasePath = join(directory, "data", "app.sqlite");
  const db = new Database(databasePath, { fileMustExist: true });
  try {
    assert.deepEqual(db.prepare("SELECT name FROM schema_migrations").all(), [
      { name: "001-create-opportunities.sql" },
    ]);
    db.prepare(`
      INSERT INTO opportunities (source, source_id, title, url, discovered_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "example-source",
      "example-001",
      "Example Developer",
      "https://example.test/jobs/001",
      "2026-10-21T12:00:00.000Z"
    );
  } finally {
    db.close();
  }

  const secondRun = runMigrations(directory);
  assert.equal(secondRun.error, undefined);
  assert.equal(secondRun.status, 0, secondRun.stderr);
  assert.match(secondRun.stdout, /Already run: 001-create-opportunities\.sql/);

  const reopened = new Database(databasePath, { readonly: true, fileMustExist: true });
  try {
    assert.deepEqual(reopened.prepare("SELECT title FROM opportunities").all(), [
      { title: "Example Developer" },
    ]);
    assert.deepEqual(reopened.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get(), {
      count: 1,
    });
  } finally {
    reopened.close();
  }
});

test("rolls back a failed migration, keeps earlier work, and stops before later files", async (t) => {
  const directory = await createFixture(t, {
    "003-later.sql": "CREATE TABLE later_work (id INTEGER PRIMARY KEY);",
    "002-failing.sql": `
      CREATE TABLE partial_work (id INTEGER PRIMARY KEY);
      THIS IS NOT VALID SQL;
    `,
    "001-create-opportunities.sql": initialMigration,
  });
  const result = runMigrations(directory);
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Applied: 001-create-opportunities\.sql/);

  const db = new Database(join(directory, "data", "app.sqlite"), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    assert.deepEqual(db.prepare("SELECT name FROM schema_migrations").all(), [
      { name: "001-create-opportunities.sql" },
    ]);
    assert.deepEqual(
      db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' ORDER BY name").all(),
      [{ name: "opportunities" }, { name: "schema_migrations" }]
    );
  } finally {
    db.close();
  }
});

test("adds location to an existing database without changing saved advertisements and runs only once", async (t) => {
  const directory = await createFixture(t, { "001-create-opportunities.sql": initialMigration });
  assert.equal(runMigrations(directory).status, 0);
  const path = join(directory, "data", "app.sqlite");
  const db = new Database(path);
  let original: unknown;
  try {
    db.prepare(`INSERT INTO opportunities (source, source_id, title, url, discovered_at)
      VALUES (?, ?, ?, ?, ?)`).run(
      "example-source", "example-001", "Saved Developer", "https://example.test/jobs/001", "2026-10-21T12:00:00.000Z"
    );
    original = db.prepare("SELECT * FROM opportunities").get();
  } finally { db.close(); }

  await writeFile(join(directory, "migrations", "002-add-opportunity-location.sql"), locationMigration);
  const upgrade = runMigrations(directory);
  assert.equal(upgrade.status, 0, upgrade.stderr);
  assert.match(upgrade.stdout, /Applied: 002-add-opportunity-location\.sql/);
  const upgraded = new Database(path);
  try {
    assert.deepEqual(upgraded.prepare("SELECT * FROM opportunities").get(), { ...(original as object), location: null });
    upgraded.prepare("UPDATE opportunities SET location = ?").run("Stockholm");
  } finally { upgraded.close(); }

  const repeated = runMigrations(directory);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.match(repeated.stdout, /Already run: 002-add-opportunity-location\.sql/);
  const reopened = new Database(path, { readonly: true, fileMustExist: true });
  try {
    assert.deepEqual(reopened.prepare("SELECT * FROM opportunities").all(), [{ ...(original as object), location: "Stockholm" }]);
    assert.deepEqual(reopened.prepare("SELECT name FROM schema_migrations ORDER BY name").all(), [
      { name: "001-create-opportunities.sql" }, { name: "002-add-opportunity-location.sql" },
    ]);
  } finally { reopened.close(); }
});

test("upgrades saved samples without changing them and records models only for live evaluations", async (t) => {
  const directory = await createFixture(t, {
    "001-create-opportunities.sql": initialMigration,
    "002-add-opportunity-location.sql": locationMigration,
    "003-create-opportunity-evaluations.sql": evaluationMigration,
  });
  assert.equal(runMigrations(directory).status, 0);
  const path = join(directory, "data", "app.sqlite");
  const db = new Database(path);
  const result = JSON.stringify({ recommendation: "needs_clarification", summary: "Saved sample.", supportingEvidence: [], gapsAndUnknowns: [] });
  try {
    db.prepare(`INSERT INTO opportunities (source, source_id, title, url, discovered_at)
      VALUES ('example', '001', 'Example Developer', 'https://example.test/job', '2026-10-22T12:00:00.000Z')`).run();
    db.prepare("INSERT INTO opportunity_evaluations VALUES (1, 'simulated', ?, ?)")
      .run(result, "2026-10-22T12:00:00.000Z");
  } finally { db.close(); }
  await writeFile(join(directory, "migrations", "004-enable-live-opportunity-evaluations.sql"), liveEvaluationMigration);
  const upgrade = runMigrations(directory);
  assert.equal(upgrade.status, 0, upgrade.stderr);
  const upgraded = new Database(path);
  try {
    assert.deepEqual(upgraded.prepare("SELECT * FROM opportunity_evaluations").get(), {
      opportunity_id: 1, mode: "simulated", model: null, result_json: result, evaluated_at: "2026-10-22T12:00:00.000Z",
    });
    assert.throws(() => upgraded.exec("UPDATE opportunity_evaluations SET mode = 'live'"), /CHECK/);
    assert.throws(() => upgraded.exec("UPDATE opportunity_evaluations SET model = 'gpt-6.1-sol'"), /CHECK/);
    assert.throws(() => upgraded.exec("UPDATE opportunity_evaluations SET mode = 'live', model = ' '"), /CHECK/);
    upgraded.exec("UPDATE opportunity_evaluations SET mode = 'live', model = 'gpt-6.1-sol'");
  } finally { upgraded.close(); }
  const repeat = runMigrations(directory);
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.match(repeat.stdout, /Already run: 004-enable-live-opportunity-evaluations/);
  const reopened = new Database(path);
  try {
    assert.deepEqual(reopened.prepare("SELECT mode, model, result_json FROM opportunity_evaluations").get(), {
      mode: "live", model: "gpt-6.1-sol", result_json: result,
    });
    reopened.exec("DELETE FROM opportunities WHERE id = 1");
    assert.deepEqual(reopened.prepare("SELECT * FROM opportunity_evaluations").all(), []);
  } finally { reopened.close(); }
});
