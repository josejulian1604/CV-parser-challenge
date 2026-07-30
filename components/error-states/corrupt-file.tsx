export function CorruptFile() {
  return (
    <div role="alert" className="rounded border border-red-800/60 bg-red-950/40 p-4">
      <p className="font-medium text-ink">We couldn&apos;t read this file</p>
      <p className="text-sm text-muted">
        It may be corrupted, password-protected, or empty. Try re-exporting
        it, or upload a different file.
      </p>
    </div>
  );
}
