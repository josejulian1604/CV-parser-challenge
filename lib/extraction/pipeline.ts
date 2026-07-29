import type { Result } from "./result";
import { AnthropicProvider, type LLMProvider } from "./structure/provider";
import { structureResume, type StructureError } from "./structure/structure";
import { validateAndRepair, type RepairError } from "./validation/repair";
import type { ResumeData } from "./schema/resume";

// classify.ts and pdf.ts (stages 1-2) run browser-side only — the file
// never leaves the browser, per architecture.md's privacy note — so they
// aren't composed here. This pipeline picks up once already-extracted text
// crosses to the server (stage 3), covering structure (stage 4) and
// validation/repair (stage 5). The upload UI (task 1.5) calls classify/
// parsePdf directly client-side and POSTs the resulting text here.
export async function runServerPipeline(
  sourceText: string,
  provider: LLMProvider = new AnthropicProvider()
): Promise<Result<ResumeData, StructureError | RepairError>> {
  const structured = await structureResume(provider, sourceText);
  if (!structured.ok) return structured;

  return validateAndRepair(provider, structured.value);
}
