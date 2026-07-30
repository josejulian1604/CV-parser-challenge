export function UnsupportedFileType() {
  return (
    <div role="alert" className="rounded border border-red-800/60 bg-red-950/40 p-4">
      <p className="font-medium text-ink">This file type isn&apos;t supported</p>
      <p className="text-sm text-muted">
        Please upload a PDF or Word (.docx) resume.
      </p>
    </div>
  );
}
