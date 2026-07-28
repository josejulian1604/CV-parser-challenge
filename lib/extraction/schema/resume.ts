import { z } from "zod";
import { DateRangeSchema } from "./date";

export const ContactSchema = z.object({
  fullName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  linkedin: z.string().nullable(),
  github: z.string().nullable(),
  website: z.string().nullable(),
});

export type ContactInfo = z.infer<typeof ContactSchema>;

export const ExperienceEntrySchema = z.object({
  company: z.string(),
  title: z.string(),
  location: z.string().nullable(),
  dateRange: DateRangeSchema,
  bullets: z.array(z.string()),
});

export type ExperienceEntry = z.infer<typeof ExperienceEntrySchema>;

export const EducationEntrySchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  fieldOfStudy: z.string().nullable(),
  dateRange: DateRangeSchema,
});

export type EducationEntry = z.infer<typeof EducationEntrySchema>;

export const AdditionalSectionSchema = z.object({
  title: z.string(),
  items: z.array(z.string()),
});

export type AdditionalSection = z.infer<typeof AdditionalSectionSchema>;

export const ResumeDataSchema = z.object({
  contact: ContactSchema,
  summary: z.string().nullable(),
  experience: z.array(ExperienceEntrySchema),
  education: z.array(EducationEntrySchema),
  skills: z.array(z.string()),
  additionalSections: z.array(AdditionalSectionSchema),
  detectedLanguage: z.enum(["en", "es"]),
});

export type ResumeData = z.infer<typeof ResumeDataSchema>;
