interface NotYetSupportedProps {
  route: "pdf-scanned" | "image";
}

const ROUTE_LABEL: Record<NotYetSupportedProps["route"], string> = {
  "pdf-scanned": "Scanned PDFs (image-only, no text layer)",
  image: "Image uploads",
};

export function NotYetSupported({ route }: NotYetSupportedProps) {
  return (
    <div role="alert" className="rounded border border-yellow-300 bg-yellow-50 p-4">
      <p className="font-medium">Not supported yet</p>
      <p className="text-sm text-gray-600">
        {ROUTE_LABEL[route]} aren&apos;t supported yet — this is on the
        roadmap. For now, please upload a text-based PDF or a Word (.docx)
        resume.
      </p>
    </div>
  );
}
