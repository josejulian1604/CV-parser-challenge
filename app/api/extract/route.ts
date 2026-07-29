import { NextRequest, NextResponse } from "next/server";
import { runServerPipeline } from "@/lib/extraction/pipeline";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body?.text !== "string" || body.text.length === 0) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const result = await runServerPipeline(body.text);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 });
    }
    return NextResponse.json(result.value);
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
