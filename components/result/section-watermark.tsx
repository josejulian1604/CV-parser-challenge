// Oversized outline word behind the About/Experience sections only
// (docs/Design-guidance.md §4) — transparent fill + stroke, so it can
// never reduce legibility of the real content stacked in front of it.
// Positioned absolutely within a relatively-positioned section wrapper;
// this is NOT position:sticky/fixed, so it has no viewport dependency and
// doesn't fall under that print constraint.
export function SectionWatermark({ word }: { word: string }) {
  return (
    <div
      aria-hidden="true"
      className="absolute -top-1.5 left-0 z-0 select-none whitespace-nowrap font-head text-[70px] font-bold leading-none tracking-tight text-transparent sm:text-[120px]"
      style={{ WebkitTextStroke: "1px var(--line)" }}
    >
      {word}
    </div>
  );
}
