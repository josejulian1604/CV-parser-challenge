export function UnsupportedFileType() {
  return (
    <div role="alert" className="rounded border border-red-300 bg-red-50 p-4">
      <p className="font-medium">This file type isn&apos;t supported</p>
      <p className="text-sm text-gray-600">
        Please upload a PDF or Word (.docx) resume.
      </p>
    </div>
  );
}
