import { MAX_PAGES } from "@/lib/config/limits";

// Not a failure — extraction still ran and results are shown; this is a
// banner alongside a successful result, not a blocking screen like the
// other components in this folder.
export function PartialTruncationNotice() {
  return (
    <p role="status" className="rounded border border-amber-800/60 bg-amber-950/40 p-3 text-sm text-ink">
      This resume has more than {MAX_PAGES} pages — only the first{" "}
      {MAX_PAGES} were processed.
    </p>
  );
}
