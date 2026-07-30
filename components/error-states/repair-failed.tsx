interface RepairFailedProps {
  onRetry: () => void;
}

export function RepairFailed({ onRetry }: RepairFailedProps) {
  return (
    <div role="alert" className="rounded border border-red-800/60 bg-red-950/40 p-4">
      <p className="font-medium text-ink">We couldn&apos;t extract this resume</p>
      <p className="text-sm text-muted">
        The extraction didn&apos;t come back in a usable format after a few
        attempts. This can happen with unusual formatting — try again, or
        try a different file.
      </p>
      <button type="button" onClick={onRetry} className="mt-2 text-sm text-ink underline">
        Try again
      </button>
    </div>
  );
}
