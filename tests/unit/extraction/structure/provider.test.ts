import { describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  RateLimitError,
  APIConnectionError,
  InternalServerError,
} from "@anthropic-ai/sdk";
import { AnthropicProvider } from "../../../../lib/extraction/structure/provider";

function fakeClient(createImpl: (...args: unknown[]) => unknown) {
  return { messages: { create: vi.fn(createImpl) } } as never;
}

const baseRequest = {
  model: "claude-haiku-4-5",
  systemPrompt: "system",
  userMessage: "hello",
  temperature: 0,
  maxTokens: 1024,
};

describe("AnthropicProvider.structuredComplete", () => {
  it("maps AuthenticationError to auth_failed", async () => {
    const client = fakeClient(() => {
      throw new AuthenticationError(401, {}, "bad key", new Headers());
    });
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result).toEqual({ ok: false, error: { kind: "auth_failed", cause: expect.any(AuthenticationError) } });
  });

  it("maps RateLimitError to rate_limited with retryAfterMs from header", async () => {
    const client = fakeClient(() => {
      throw new RateLimitError(429, {}, "slow down", new Headers({ "retry-after": "5" }));
    });
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result).toEqual({ ok: false, error: { kind: "rate_limited", retryAfterMs: 5000 } });
  });

  it("maps RateLimitError with no retry-after header to null retryAfterMs", async () => {
    const client = fakeClient(() => {
      throw new RateLimitError(429, {}, "slow down", new Headers());
    });
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result).toEqual({ ok: false, error: { kind: "rate_limited", retryAfterMs: null } });
  });

  it("maps APIConnectionError to network_error", async () => {
    const client = fakeClient(() => {
      throw new APIConnectionError({ message: "network down" });
    });
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result).toEqual({ ok: false, error: { kind: "network_error", cause: expect.any(APIConnectionError) } });
  });

  it("maps other APIError subclasses to provider_unavailable", async () => {
    const client = fakeClient(() => {
      throw new InternalServerError(500, {}, "oops", new Headers());
    });
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result).toEqual({ ok: false, error: { kind: "provider_unavailable", cause: expect.any(InternalServerError) } });
  });

  it("returns refused when stop_reason is refusal", async () => {
    const client = fakeClient(() => ({
      stop_reason: "refusal",
      stop_details: { category: "cyber" },
      content: [],
    }));
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result).toEqual({ ok: false, error: { kind: "refused", category: "cyber" } });
  });

  it("returns malformed_response when there is no text block", async () => {
    const client = fakeClient(() => ({
      stop_reason: "end_turn",
      stop_details: null,
      content: [{ type: "tool_use" }],
    }));
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("malformed_response");
  });

  it("returns malformed_response when the text block isn't valid JSON", async () => {
    const client = fakeClient(() => ({
      stop_reason: "end_turn",
      stop_details: null,
      content: [{ type: "text", text: "not json" }],
    }));
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("malformed_response");
  });

  it("strips a markdown code fence before parsing", async () => {
    const client = fakeClient(() => ({
      stop_reason: "end_turn",
      stop_details: null,
      content: [{ type: "text", text: '```json\n{"contact":{"fullName":"Jane"}}\n```' }],
    }));
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result).toEqual({ ok: true, value: { contact: { fullName: "Jane" } } });
  });

  it("returns ok with parsed JSON on success", async () => {
    const client = fakeClient(() => ({
      stop_reason: "end_turn",
      stop_details: null,
      content: [{ type: "text", text: '{"contact":{"fullName":"Jane"}}' }],
    }));
    const provider = new AnthropicProvider(client);
    const result = await provider.structuredComplete(baseRequest);
    expect(result).toEqual({ ok: true, value: { contact: { fullName: "Jane" } } });
  });
});
