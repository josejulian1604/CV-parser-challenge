import { describe, expect, it } from "vitest";
import { runServerPipeline } from "../../../lib/extraction/pipeline";
import type { LLMProvider, StructuredCompletionRequest } from "../../../lib/extraction/structure/provider";

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

function fakeProviderQueue(responses: unknown[]) {
  const calls: StructuredCompletionRequest[] = [];
  const provider: LLMProvider = {
    structuredComplete: async (req) => {
      calls.push(req);
      const next = responses.shift();
      return { ok: true, value: next };
    },
  };
  return { provider, calls };
}

describe("runServerPipeline", () => {
  it("returns ok when structure produces already-valid JSON", async () => {
    const { provider, calls } = fakeProviderQueue([validResumeData()]);
    const result = await runServerPipeline("some resume text", provider);
    expect(result).toEqual({ ok: true, value: validResumeData() });
    expect(calls.length).toBe(1); // structure only, repair never called
  });

  it("passes through a structure-stage provider error unchanged", async () => {
    const provider: LLMProvider = {
      structuredComplete: async () => ({ ok: false, error: { kind: "auth_failed", cause: "bad key" } }),
    };
    const result = await runServerPipeline("text", provider);
    expect(result).toEqual({ ok: false, error: { kind: "auth_failed", cause: "bad key" } });
  });

  it("repairs an invalid structure result and returns ok", async () => {
    const { detectedLanguage: _omit, ...missingLanguage } = validResumeData();
    const { provider, calls } = fakeProviderQueue([missingLanguage, validResumeData()]);
    const result = await runServerPipeline("some resume text", provider);
    expect(result).toEqual({ ok: true, value: validResumeData() });
    expect(calls.length).toBe(2); // structure + one repair attempt
  });
});
