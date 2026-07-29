import { describe, expect, it } from "vitest";
import { structureResume } from "../../../../lib/extraction/structure/structure";
import type {
  LLMProvider,
  StructuredCompletionRequest,
} from "../../../../lib/extraction/structure/provider";

describe("structureResume", () => {
  it("calls the provider with Haiku 4.5, temperature 0, and the schema embedded in the system prompt", async () => {
    let captured: StructuredCompletionRequest | undefined;
    const fakeProvider: LLMProvider = {
      structuredComplete: async (req) => {
        captured = req;
        return { ok: true, value: { fake: true } };
      },
    };

    const result = await structureResume(fakeProvider, "some resume text");

    expect(result).toEqual({ ok: true, value: { fake: true } });
    expect(captured?.model).toBe("claude-haiku-4-5");
    expect(captured?.temperature).toBe(0);
    expect(captured?.userMessage).toBe("some resume text");
    expect(captured?.systemPrompt).toContain("detectedLanguage");
    expect(captured?.systemPrompt).toContain('"type":"object"');
  });

  it("passes through provider errors unchanged", async () => {
    const fakeProvider: LLMProvider = {
      structuredComplete: async () => ({
        ok: false,
        error: { kind: "auth_failed", cause: "bad key" },
      }),
    };

    const result = await structureResume(fakeProvider, "text");

    expect(result).toEqual({ ok: false, error: { kind: "auth_failed", cause: "bad key" } });
  });
});
