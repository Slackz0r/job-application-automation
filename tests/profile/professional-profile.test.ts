import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadProfessionalProfile } from "../../src/lib/professional-profile.ts";

test("loads multiple experiences and education, preserving evidence and uncertainty", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "professional-profile-"));
  const filePath = join(directory, "profile.json");
  t.after(async () => {
    await rm(filePath, { force: true });
    await rmdir(directory);
  });
  const example = JSON.parse(
    await readFile(new URL("../../professional-profile.example.json", import.meta.url), "utf8"),
  );
  const profile = {
    ...example,
    careerPreferences: { workingEnvironment: "Collaborative team" },
  };
  profile.experiences.professional[0].reflection = { lessons: ["Ask for feedback early."] };
  profile.experiences.education[0].projects[0].verificationNeeded = ["Confirm the project date."];
  await writeFile(filePath, JSON.stringify(profile));

  const result = await loadProfessionalProfile(filePath);

  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.deepEqual(result.profile, profile);
  }
});

test("accepts unfinished sections and missing dates or contribution lists without filling them", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "professional-profile-"));
  const filePath = join(directory, "profile.json");
  t.after(async () => {
    await rm(filePath, { force: true });
    await rmdir(directory);
  });
  const profile = JSON.parse(
    await readFile(new URL("../../professional-profile.example.json", import.meta.url), "utf8"),
  );
  profile.skillsAndCompetencies = {};
  profile.personalityAndInterests = {};
  for (const experience of profile.experiences.professional) {
    delete experience.dates;
    delete experience.contributions;
  }
  delete profile.experiences.education[0].projects;
  await writeFile(filePath, JSON.stringify(profile));

  assert.deepEqual(await loadProfessionalProfile(filePath), { status: "ready", profile });

  profile.experiences = { professional: [], education: [] };
  await writeFile(filePath, JSON.stringify(profile));
  assert.deepEqual(await loadProfessionalProfile(filePath), { status: "ready", profile });
});

test("reports a missing profile without throwing", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "professional-profile-"));
  t.after(() => rmdir(directory));

  assert.deepEqual(await loadProfessionalProfile(join(directory, "missing.json")), {
    status: "missing",
  });
});

test("rejects malformed JSON and invalid fields without returning private content", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "professional-profile-"));
  const filePath = join(directory, "profile.json");
  t.after(async () => {
    await rm(filePath, { force: true });
    await rmdir(directory);
  });
  const example = JSON.parse(
    await readFile(new URL("../../professional-profile.example.json", import.meta.url), "utf8"),
  );

  for (const content of [
    '{"privateNote":',
    "null",
    JSON.stringify({ id: "old-format", company: "Example Company", role: "Intern", type: "internship", summary: "Old single-experience format", contributions: [] }),
    JSON.stringify({ ...example, careerPreferences: [] }),
    JSON.stringify({ ...example, skillsAndCompetencies: "JavaScript" }),
    JSON.stringify({ ...example, experiences: { professional: {}, education: [] } }),
    ...[
      { role: 42 },
      { dates: "Unknown" },
      { contributions: [{ name: "Example", verificationNeeded: "Unconfirmed" }] },
    ].map((fields) => JSON.stringify({
      ...example,
      experiences: { ...example.experiences, professional: [{ ...example.experiences.professional[0], ...fields }] },
    })),
    JSON.stringify({
      ...example,
      experiences: { ...example.experiences, education: [{ ...example.experiences.education[0], institution: 42 }] },
    }),
  ]) {
    await writeFile(filePath, content);
    assert.deepEqual(await loadProfessionalProfile(filePath), { status: "invalid" });
  }
});

test("reports unreadable input without returning filesystem details", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "professional-profile-"));
  t.after(() => rmdir(directory));

  assert.deepEqual(await loadProfessionalProfile(directory), { status: "unavailable" });
});
