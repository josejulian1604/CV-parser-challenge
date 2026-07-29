import Anthropic, {
  AuthenticationError,
  RateLimitError,
  APIConnectionError,
  APIError,
} from "@anthropic-ai/sdk";
import type { Result } from "../result";

export type ProviderError =
  | { kind: "auth_failed"; cause: unknown }
  | { kind: "rate_limited"; retryAfterMs: number | null }
  | { kind: "provider_unavailable"; cause: unknown }
  | { kind: "network_error"; cause: unknown }
  | { kind: "refused"; category: string | null }
  | { kind: "malformed_response"; cause: unknown };

export interface StructuredCompletionRequest {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMProvider {
  structuredComplete(
    req: StructuredCompletionRequest
  ): Promise<Result<unknown, ProviderError>>;
}

export class AnthropicProvider implements LLMProvider {
  constructor(private readonly client: Anthropic = new Anthropic()) {}

  async structuredComplete(
    req: StructuredCompletionRequest
  ): Promise<Result<unknown, ProviderError>> {
    let response;
    try {
      response = await this.client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        temperature: req.temperature,
        system: [
          {
            type: "text",
            text: req.systemPrompt,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: req.userMessage }],
      });
    } catch (cause) {
      return { ok: false, error: classifyError(cause) };
    }

    if (response.stop_reason === "refusal") {
      return {
        ok: false,
        error: { kind: "refused", category: response.stop_details?.category ?? null },
      };
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return {
        ok: false,
        error: { kind: "malformed_response", cause: "no text block in response" },
      };
    }

    try {
      return { ok: true, value: JSON.parse(stripMarkdownFence(textBlock.text)) };
    } catch (cause) {
      return { ok: false, error: { kind: "malformed_response", cause } };
    }
  }
}

// Without output_config.format (dropped — see structure.ts for why), the
// model isn't API-constrained to emit bare JSON, so it can still wrap the
// response in a ```json fence despite the system prompt saying not to.
function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenced ? fenced[1] : trimmed;
}

function classifyError(cause: unknown): ProviderError {
  if (cause instanceof AuthenticationError) {
    return { kind: "auth_failed", cause };
  }
  if (cause instanceof RateLimitError) {
    const retryAfter = cause.headers?.get?.("retry-after");
    return {
      kind: "rate_limited",
      retryAfterMs: retryAfter ? Number(retryAfter) * 1000 : null,
    };
  }
  if (cause instanceof APIConnectionError) {
    return { kind: "network_error", cause };
  }
  if (cause instanceof APIError) {
    return { kind: "provider_unavailable", cause };
  }
  return { kind: "provider_unavailable", cause };
}
