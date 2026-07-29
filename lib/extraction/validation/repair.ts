import { z } from "zod";
import type { Result } from "../result";
import { ResumeDataSchema, type ResumeData } from "../schema/resume";
import type { LLMProvider, ProviderError } from "../structure/provider";

export type RepairError =
  | { kind: "validation_failed"; issues: z.core.$ZodIssue[]; attempts: number }
  | { kind: "repair_call_failed"; cause: ProviderError; attempt: number };

const HAIKU_MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 8192;
const MAX_REPAIR_ATTEMPTS = 2;

const REPAIR_SYSTEM_PROMPT = `You previously extracted resume data as JSON, but it failed schema validation. You will be given the malformed JSON and the specific validation errors that were found.

Fix ONLY the reported errors. Do not change, reformat, or re-derive any field that was not flagged. Do not invent data that isn't already present in the JSON — if a required field is missing a value, use null (or an empty array, for list fields) exactly as the original extraction rules specify.

Return the complete corrected JSON object — the full object, not a diff or just the fixed fields — matching the same overall shape as the input. Return ONLY the JSON object: no markdown code fences, no prose before or after it.`;

function formatPath(path: PropertyKey[]): string {
  return path
    .map((segment, i) =>
      typeof segment === "number" ? `[${segment}]` : i === 0 ? String(segment) : `.${String(segment)}`
    )
    .join("");
}

function buildRepairUserMessage(malformedValue: unknown, issues: z.core.$ZodIssue[]): string {
  const issueList = issues
    .map((issue) => `- ${formatPath(issue.path)}: ${issue.message} (${issue.code})`)
    .join("\n");

  return `Validation errors:
${issueList}

Malformed JSON:
${JSON.stringify(malformedValue)}`;
}

// Stage 4 dropped API-enforced schema validation (see structure.ts) because
// ResumeDataSchema exceeds Anthropic's union-parameter cap for
// output_config.format. That makes this the only structural safety net
// between raw model output and ResumeData, not a rare edge case.
export async function validateAndRepair(
  provider: LLMProvider,
  rawValue: unknown
): Promise<Result<ResumeData, RepairError>> {
  const initial = ResumeDataSchema.safeParse(rawValue);
  if (initial.success) {
    return { ok: true, value: initial.data };
  }

  let currentValue = rawValue;
  let issues = initial.error.issues;

  for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
    const repairResult = await provider.structuredComplete({
      model: HAIKU_MODEL,
      systemPrompt: REPAIR_SYSTEM_PROMPT,
      userMessage: buildRepairUserMessage(currentValue, issues),
      temperature: 0,
      maxTokens: MAX_TOKENS,
    });

    // A provider-level failure (auth, rate limit, ...) here means the SDK's
    // own retry logic already gave up — a second repair attempt wouldn't
    // help, so this terminates rather than consuming another attempt.
    if (!repairResult.ok) {
      return { ok: false, error: { kind: "repair_call_failed", cause: repairResult.error, attempt } };
    }

    currentValue = repairResult.value;
    const reparsed = ResumeDataSchema.safeParse(currentValue);
    if (reparsed.success) {
      return { ok: true, value: reparsed.data };
    }
    issues = reparsed.error.issues;
  }

  return { ok: false, error: { kind: "validation_failed", issues, attempts: MAX_REPAIR_ATTEMPTS } };
}
