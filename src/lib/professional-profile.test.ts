import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadProfessionalProfile } from "./professional-profile.ts";

test("loads the full experience, including uncertain and additional information", async (t) => {
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
    reflection: { lessons: ["Ask for feedback early."] },
  };
  await writeFile(filePath, JSON.stringify(profile));

  const result = await loadProfessionalProfile(filePath);

  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.deepEqual(result.profile, profile);
  }
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
    JSON.stringify({ ...example, role: 42 }),
    JSON.stringify({ ...example, contributions: [{ name: "Example", verificationNeeded: "Unconfirmed" }] }),
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
