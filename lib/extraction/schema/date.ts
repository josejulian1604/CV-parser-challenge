import { z } from "zod";

export const PartialDateSchema = z.object({
  year: z.number().int().min(1950).max(2100),
  month: z.number().int().min(1).max(12).nullable(),
  raw: z.string(),
});

export type PartialDate = z.infer<typeof PartialDateSchema>;

export const DateRangeSchema = z.object({
  start: PartialDateSchema.nullable(),
  end: PartialDateSchema.nullable(),
  isCurrent: z.boolean(),
});

export type DateRange = z.infer<typeof DateRangeSchema>;
