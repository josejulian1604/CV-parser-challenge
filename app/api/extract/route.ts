import { NextRequest, NextResponse } from "next/server";
import { runServerPipeline } from "@/lib/extraction/pipeline";
import type { MessageContentPart } from "@/lib/extraction/structure/provider";

// The four media types Anthropic's API actually accepts for an image block —
// checked here, at the request boundary, so a malformed/arbitrary client-
// supplied value never reaches the real API call (which would still fail
// safely, just as a wasted call misclassified as a generic provider error
// rather than the input-validation problem it actually is).
const ACCEPTED_IMAGE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function contentFromBody(body: unknown): string | MessageContentPart[] | null {
  const b = body as { text?: unknown; images?: unknown };

  if (typeof b?.text === "string" && b.text.length > 0) {
    return b.text;
  }

  if (Array.isArray(b?.images) && b.images.length > 0) {
    const valid = b.images.every(
      (img) =>
        img &&
        typeof img.mediaType === "string" &&
        ACCEPTED_IMAGE_MEDIA_TYPES.has(img.mediaType) &&
        typeof img.data === "string" &&
        img.data.length > 0
    );
    if (!valid) return null;
    return b.images.map((img) => ({ type: "image" as const, mediaType: img.mediaType, data: img.data }));
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const content = contentFromBody(body);
    if (content === null) {
      return NextResponse.json({ error: "text or images is required" }, { status: 400 });
    }

    const result = await runServerPipeline(content);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json(result.value);
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
