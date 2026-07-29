export function CorruptFile() {
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 p-4">
      <p className="font-medium">We couldn&apos;t read this file</p>
      <p className="text-sm text-gray-600">
        It may be corrupted, password-protected, or empty. Try re-exporting
        it, or upload a different file.
      </p>
    </div>
  );
}
