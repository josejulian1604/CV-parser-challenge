// Distinguishes "the model looked and found nothing" from "—" (which reads
// as just an empty/unset field) for fields critical enough that their
// absence is worth calling out rather than blending in.
export function MissingFieldIndicator() {
  return <span className="italic text-gray-400">Not found</span>;
}
