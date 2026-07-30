import type { Result } from "./result";
import { normalizeContact } from "./normalize/contact";
import { normalizeDateRange, sortExperienceByRecency } from "./normalize/dates";
import { normalizeSkills } from "./normalize/skills";
import { AnthropicProvider, type LLMProvider, type MessageContentPart } from "./structure/provider";
import { structureResume, type StructureError } from "./structure/structure";
import { validateAndRepair, type RepairError } from "./validation/repair";
import type { ResumeData } from "./schema/resume";
import type { NormalizedResumeData } from "./schema/normalized";

// Stage 8: dates/contact/skills are independently re-derived server-side
// regardless of what the model claimed (see docs/architecture.md, "Normalize
// output"). Pure and total — normalization can't fail, so no new error type.
function normalizeResume(data: ResumeData): NormalizedResumeData {
  return {
    ...data,
    contact: normalizeContact(data.contact),
    skills: normalizeSkills(data.skills),
    experience: sortExperienceByRecency(
      data.experience.map((entry) => ({
        ...entry,
        dateRange: normalizeDateRange(entry.dateRange),
      }))
    ),
    education: data.education.map((entry) => ({
      ...entry,
      dateRange: normalizeDateRange(entry.dateRange),
    })),
  };
}

// classify.ts and pdf.ts (stages 1-2) run browser-side only — the file
// never leaves the browser, per architecture.md's privacy note — so they
// aren't composed here. This pipeline picks up once already-extracted text
// crosses to the server (stage 3), covering structure (stage 4) and
// validation/repair (stage 5). The upload UI (task 1.5) calls classify/
// parsePdf directly client-side and POSTs the resulting text here.
export async function runServerPipeline(
  content: string | MessageContentPart[],
  provider: LLMProvider = new AnthropicProvider()
): Promise<Result<NormalizedResumeData, StructureError | RepairError>> {
  const structured = await structureResume(provider, content);
  if (!structured.ok) return structured;

  const repaired = await validateAndRepair(provider, structured.value);
  if (!repaired.ok) return repaired;

  return { ok: true, value: normalizeResume(repaired.value) };
}
