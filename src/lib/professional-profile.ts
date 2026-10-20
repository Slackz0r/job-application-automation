import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

// Validate the existing experience format while retaining its richer details.
const professionalProfileSchema = z.looseObject({
  id: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  type: z.string().min(1),
  summary: z.string().min(1),
  contributions: z.array(
    z.looseObject({
      name: z.string().min(1),
      verificationNeeded: z.array(z.string()).optional(),
    }),
  ),
});

export type ProfessionalProfile = z.infer<typeof professionalProfileSchema>;

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
