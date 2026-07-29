import { MAX_PAGES } from "@/lib/config/limits";

// Not a failure — extraction still ran and results are shown; this is a
// banner alongside a successful result, not a blocking screen like the
// other components in this folder.
export function PartialTruncationNotice() {
  return (
    <p role="status" className="rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
      This resume has more than {MAX_PAGES} pages — only the first{" "}
      {MAX_PAGES} were processed.
    </p>
  );
}
