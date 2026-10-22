import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import Database from "better-sqlite3";
import { createEvaluationInput, simulateOpportunityEvaluation } from "./opportunity-evaluation.ts";
import { getEvaluation, getEvaluations, saveEvaluation } from "./opportunity-evaluations.ts";
import { saveOpportunity } from "./opportunities.ts";
import { professionalProfileSchema } from "../schemas/professional-profile.ts";
import type { Opportunity } from "../schemas/opportunity.ts";

const profileExample = JSON.parse(readFileSync(new URL("../../professional-profile.example.json", import.meta.url), "utf8"));
const advertisement = {
  source: "example", sourceId: "job-001", title: "Example Developer",
  description: "Build web interfaces and work with an existing API.", url: "https://example.test/job/001",
};
const opportunity: Opportunity = {
  ...advertisement, id: 1, company: null, location: null,
  applicationDeadline: null, publishedAt: null, discoveredAt: "2026-10-22T12:00:00.000Z",
};

test("prepares only approved profile sections, preserving unknowns and uncertainty notes", () => {
  const profile = professionalProfileSchema.parse({
    ...profileExample,
    personalityAndInterests: { name: "PRIVATE PERSONAL MARKER", interests: ["PRIVATE HOBBY MARKER"] },
    privateNotes: "PRIVATE TOP LEVEL MARKER",
    experiences: { ...profileExample.experiences, otherPrivateDetails: "PRIVATE EXPERIENCE GROUP MARKER" },
  });
  const input = createEvaluationInput(opportunity, profile);
  assert.deepEqual(input.profile, {
    skillsAndCompetencies: profile.skillsAndCompetencies,
    experiences: { professional: profile.experiences.professional, education: profile.experiences.education },
    careerPreferences: {},
  });
  assert.doesNotMatch(JSON.stringify(input), /PRIVATE/);
  assert.equal("dates" in input.profile.experiences.professional[0], false);
  assert.deepEqual(input.profile.experiences.professional[0].contributions?.[0].verificationNeeded,
    profileExample.experiences.professional[0].contributions[0].verificationNeeded);
});

test("simulation is visibly illustrative, makes no network calls, and requires advertisement text", (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", () => { throw new Error("Network calls are forbidden"); });
  const profile = professionalProfileSchema.parse(profileExample);
  const result = simulateOpportunityEvaluation(opportunity, profile);
  assert.equal(result.recommendation, "needs_clarification");
  assert.match(result.summary, /does not assess your suitability/);
  assert.match(result.supportingEvidence[0], /Example only/);
  assert.match(result.gapsAndUnknowns[1], /unknown/);
  for (const description of [null, "", " \n "]) {
    assert.throws(() => simulateOpportunityEvaluation({ ...opportunity, description }, profile), /text is required/);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("validates results, persists across connections, and replaces only the selected opportunity's result", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "job-evaluations-"));
  const path = join(directory, "app.sqlite");
  const db = new Database(path);
  t.after(() => {
    if (db.open) db.close();
    assert.equal(dirname(directory), resolve(tmpdir()));
    rmSync(directory, { recursive: true, force: true });
  });
  for (const name of ["001-create-opportunities.sql", "002-add-opportunity-location.sql", "003-create-opportunity-evaluations.sql"]) {
    db.exec(readFileSync(new URL(`../../migrations/${name}`, import.meta.url), "utf8"));
  }
  const first = saveOpportunity(db, advertisement);
  const second = saveOpportunity(db, { ...advertisement, sourceId: "job-002" });
  const result = simulateOpportunityEvaluation(first, professionalProfileSchema.parse(profileExample));
  const saved = saveEvaluation(db, first.id, result);
  const other = saveEvaluation(db, second.id, result);
  assert.equal(saved.mode, "simulated");
  for (const input of [{ ...result, recommendation: "guaranteed_hire" }, { ...result, supportingEvidence: "Unsupported" }]) {
    assert.throws(() => saveEvaluation(db, first.id, input));
    assert.deepEqual(getEvaluation(db, first.id), saved);
  }
  assert.throws(() => saveEvaluation(db, 999, result), /FOREIGN KEY/);
  assert.equal(getEvaluation(db, 999), null);
  assert.deepEqual(getEvaluations(db, []), {});
  assert.throws(() => getEvaluations(db, [-1]));
  const replacement = saveEvaluation(db, first.id, { ...result, summary: "Another simulated result." });
  assert.deepEqual(db.prepare("SELECT count(*) AS count FROM opportunity_evaluations").get(), { count: 2 });
  db.close();
  const reopened = new Database(path, { fileMustExist: true });
  try {
    assert.deepEqual(getEvaluation(reopened, first.id), replacement);
    assert.deepEqual(getEvaluations(reopened, [first.id, second.id]), { [first.id]: replacement, [second.id]: other });
  } finally {
    reopened.close();
  }
});
