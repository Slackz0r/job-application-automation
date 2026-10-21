import { z } from "zod";

const namedEvidenceSchema = z.looseObject({
  name: z.string().min(1),
  verificationNeeded: z.array(z.string()).optional(),
});

const professionalExperienceSchema = z.looseObject({
  id: z.string().min(1),
  company: z.string().min(1),
  role: z.string().min(1),
  type: z.string().min(1),
  summary: z.string().min(1),
  dates: z.looseObject({}).optional(),
  contributions: z.array(namedEvidenceSchema).optional(),
  verificationNeeded: z.array(z.string()).optional(),
});

const educationSchema = z.looseObject({
  id: z.string().min(1),
  institution: z.string().min(1),
  programme: z.string().min(1),
  type: z.string().min(1),
  summary: z.string().min(1),
  dates: z.looseObject({}).optional(),
  projects: z.array(namedEvidenceSchema).optional(),
  verificationNeeded: z.array(z.string()).optional(),
});

// Check the working structure without discarding rich details or filling unknowns.
export const professionalProfileSchema = z.looseObject({
  skillsAndCompetencies: z.looseObject({}),
  experiences: z.looseObject({
    professional: z.array(professionalExperienceSchema),
    education: z.array(educationSchema),
  }),
  personalityAndInterests: z.looseObject({}),
  careerPreferences: z.looseObject({}),
});

export type ProfessionalProfile = z.infer<typeof professionalProfileSchema>;
