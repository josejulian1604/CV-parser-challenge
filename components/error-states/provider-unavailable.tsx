export type ProviderUnavailableKind =
  | "auth_failed"
  | "rate_limited"
  | "provider_unavailable"
  | "network_error"
  | "refused"
  | "malformed_response"
  | "repair_call_failed";

interface ProviderUnavailableProps {
  kind: ProviderUnavailableKind;
  retryAfterMs?: number | null;
  onRetry: () => void;
}

function messageFor(kind: ProviderUnavailableProps["kind"], retryAfterMs?: number | null): string {
  switch (kind) {
    case "rate_limited":
      return retryAfterMs
        ? `We're getting a lot of requests right now — please wait about ${Math.ceil(retryAfterMs / 1000)}s and try again.`
        : "We're getting a lot of requests right now — please wait a moment and try again.";
    case "auth_failed":
    case "provider_unavailable":
    case "repair_call_failed":
      return "The extraction service is temporarily unavailable. Please try again in a moment.";
    case "network_error":
      return "We couldn't reach the extraction service. Check your connection and try again.";
    case "refused":
    case "malformed_response":
      return "The extraction service couldn't process this document. Please try again.";
  }
}

export function ProviderUnavailable({ kind, retryAfterMs, onRetry }: ProviderUnavailableProps) {
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 p-4">
      <p className="font-medium">Extraction failed</p>
      <p className="text-sm text-gray-600">{messageFor(kind, retryAfterMs)}</p>
      <button type="button" onClick={onRetry} className="mt-2 text-sm underline">
        Try again
      </button>
    </div>
  );
}
