// Distinguishes "the model looked and found nothing" from "—" (which reads
// as just an empty/unset field) for fields critical enough that their
// absence is worth calling out rather than blending in. Styled as
// monospace/muted to match the portfolio design's existing convention of
// using Geist Mono for meta text (dates, labels) — reads as an intentional
// state, not an error bolted onto the layout.
export function MissingFieldIndicator() {
  return <span className="font-mono text-muted">[not found]</span>;
}
