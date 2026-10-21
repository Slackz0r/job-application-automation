import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { professionalProfileSchema, type ProfessionalProfile } from "../schemas/professional-profile.ts";

type ProfileLoadResult =
  | { status: "ready"; profile: ProfessionalProfile }
  | { status: "missing" | "invalid" | "unavailable" };

export async function loadProfessionalProfile(
  filePath = join(process.cwd(), "professional-profile.json"),
): Promise<ProfileLoadResult> {
  let content: string;

  try {
    // Private runtime data is supplied locally, outside the compiled output.
    content = await readFile(/* turbopackIgnore: true */ filePath, "utf8");
  } catch (error) {
    const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
    return { status: missing ? "missing" : "unavailable" };
  }

  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch {
    return { status: "invalid" };
  }

  const result = professionalProfileSchema.safeParse(data);

  return result.success
    ? { status: "ready", profile: result.data }
    : { status: "invalid" };
}
