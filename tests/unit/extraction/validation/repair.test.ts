import { describe, expect, it } from "vitest";
import { validateAndRepair } from "../../../../lib/extraction/validation/repair";
import type {
  LLMProvider,
  StructuredCompletionRequest,
  ProviderError,
} from "../../../../lib/extraction/structure/provider";

// repair.ts always builds a text prompt (it operates on malformed JSON text,
// never an image) — narrows the provider-agnostic userMessage type back to
// string for assertions that need string-only methods like .split.
function asText(userMessage: StructuredCompletionRequest["userMessage"]): string {
  if (typeof userMessage !== "string") {
    throw new Error("expected a text userMessage, got image content");
  }
  return userMessage;
}

function validResumeData() {
  return {
    contact: {
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: null,
      location: null,
      linkedin: null,
      github: null,
      website: null,
    },
    summary: null,
    experience: [],
    education: [],
    skills: [],
    additionalSections: [],
    detectedLanguage: "en",
  };
}

function missingRequiredFieldValue() {
  const { detectedLanguage: _omit, ...rest } = validResumeData();
  return rest;
}

function wrongTypeValue() {
  return { ...validResumeData(), contact: { ...validResumeData().contact, email: 12345 } };
}

function fakeProviderQueue(responses: Array<{ ok: true; value: unknown } | { ok: false; error: ProviderError }>) {
  const calls: StructuredCompletionRequest[] = [];
  const provider: LLMProvider = {
    structuredComplete: async (req) => {
      calls.push(req);
      const next = responses.shift();
      if (!next) throw new Error("fakeProviderQueue exhausted — test requested more calls than expected");
      return next;
    },
  };
  return { provider, calls };
}

describe("validateAndRepair", () => {
  it("returns ok immediately for already-valid input, without calling the provider", async () => {
    const { provider, calls } = fakeProviderQueue([]);
    const result = await validateAndRepair(provider, validResumeData());
    expect(result).toEqual({ ok: true, value: validResumeData() });
    expect(calls.length).toBe(0);
  });

  it("repairs a missing required field (detectedLanguage) in one attempt", async () => {
    const { provider, calls } = fakeProviderQueue([{ ok: true, value: validResumeData() }]);
    const result = await validateAndRepair(provider, missingRequiredFieldValue());
    expect(result).toEqual({ ok: true, value: validResumeData() });
    expect(calls.length).toBe(1);
    expect(calls[0].userMessage).toContain("detectedLanguage");
    expect(calls[0].userMessage).toContain("Malformed JSON:");
  });

  it("repairs a wrong-type field (contact.email as a number) in one attempt", async () => {
    const { provider, calls } = fakeProviderQueue([{ ok: true, value: validResumeData() }]);
    const result = await validateAndRepair(provider, wrongTypeValue());
    expect(result).toEqual({ ok: true, value: validResumeData() });
    expect(calls.length).toBe(1);
    expect(calls[0].userMessage).toContain("contact.email");
    expect(calls[0].userMessage).toContain("invalid_type");
  });

  it("takes 2 attempts when the first repair is still invalid, and progresses the issue list", async () => {
    // Attempt 1's response fixes the original problem (missing detectedLanguage)
    // but introduces a NEW, different one (wrong-type email) — deliberately
    // distinct from the original error, so this test can tell "attempt 2's
    // prompt reflects attempt 2's own errors" apart from "attempt 2's prompt
    // is just a cached copy of attempt 1's errors" (a real bug this exact
    // test failed to catch until this fixture was made to differ — see the
    // mutation-testing check this test was strengthened after).
    const { provider, calls } = fakeProviderQueue([
      { ok: true, value: wrongTypeValue() }, // attempt 1: different error now
      { ok: true, value: validResumeData() }, // attempt 2: fixed
    ]);
    const result = await validateAndRepair(provider, missingRequiredFieldValue());
    expect(result).toEqual({ ok: true, value: validResumeData() });
    expect(calls.length).toBe(2);
    expect(calls[0].userMessage).toContain("detectedLanguage");
    expect(calls[0].userMessage).not.toContain("contact.email");
    // Attempt 2's prompt must describe attempt 1's actual output (wrong-type
    // email), not a stale copy of the original (missing detectedLanguage).
    // Scoped to the "Validation errors:" bullet line, not the whole prompt —
    // the malformed-JSON blob legitimately contains the literal key
    // "detectedLanguage" (it's present and valid in attempt 1's output), so
    // a substring check against the full message would false-negative here.
    const issuesLine = asText(calls[1].userMessage).split("\n\nMalformed JSON:")[0];
    expect(issuesLine).toContain("contact.email");
    expect(issuesLine).not.toContain("- detectedLanguage:");
  });

  it("returns validation_failed with attempts:2 when both repairs stay invalid", async () => {
    const { provider, calls } = fakeProviderQueue([
      { ok: true, value: missingRequiredFieldValue() },
      { ok: true, value: wrongTypeValue() },
    ]);
    const result = await validateAndRepair(provider, missingRequiredFieldValue());
    expect(calls.length).toBe(2);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation_failed");
      if (result.error.kind === "validation_failed") {
        expect(result.error.attempts).toBe(2);
        // Final issues reflect attempt-2's output (wrong-type email), not attempt-1's.
        expect(result.error.issues.some((issue) => issue.path.join(".") === "contact.email")).toBe(true);
      }
    }
  });

  it("returns repair_call_failed immediately on a provider error, without a second attempt", async () => {
    const { provider, calls } = fakeProviderQueue([
      { ok: false, error: { kind: "rate_limited", retryAfterMs: 1000 } },
    ]);
    const result = await validateAndRepair(provider, missingRequiredFieldValue());
    expect(calls.length).toBe(1);
    expect(result).toEqual({
      ok: false,
      error: { kind: "repair_call_failed", cause: { kind: "rate_limited", retryAfterMs: 1000 }, attempt: 1 },
    });
  });
});
