import { z } from "zod";
import type { Result } from "../result";
import { ResumeDataSchema } from "../schema/resume";
import { CURRENT_SYSTEM_PROMPT } from "./prompt";
import type { LLMProvider, ProviderError } from "./provider";

export type StructureError = ProviderError;

const HAIKU_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 8192;

// Anthropic's schema-compiled structured outputs (output_config.format) cap
// total union-typed (nullable) schema parameters at 16 — ResumeDataSchema's
// nullable fields, once nested schemas like DateRangeSchema are inlined per
// occurrence, come to 19, over the limit (confirmed against the real API).
// Rather than weaken the schema's deliberate "always null, never omit" design
// from task 1.1, the schema is embedded as prompt text instead: the model
// isn't API-constrained to it, but stage 5's future ResumeDataSchema.safeParse()
// + repair loop is exactly what exists to catch structural mistakes.
const RESUME_JSON_SCHEMA = z.toJSONSchema(ResumeDataSchema);

const FULL_SYSTEM_PROMPT = `${CURRENT_SYSTEM_PROMPT}

Return ONLY a single valid JSON object matching this JSON Schema exactly — no markdown code fences, no prose before or after it:

${JSON.stringify(RESUME_JSON_SCHEMA)}`;

export async function structureResume(
  provider: LLMProvider,
  sourceText: string
): Promise<Result<unknown, StructureError>> {
  return provider.structuredComplete({
    model: HAIKU_MODEL,
    systemPrompt: FULL_SYSTEM_PROMPT,
    userMessage: sourceText,
    temperature: 0,
    maxTokens: MAX_TOKENS,
  });
}
