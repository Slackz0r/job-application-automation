import { z } from "zod";

// Validate the existing experience format while retaining its richer details.
export const professionalProfileSchema = z.looseObject({
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
