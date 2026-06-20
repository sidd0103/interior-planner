import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractMeasurements, type ImageMediaType } from "@/lib/clients/visionClient";

const Body = z.object({
  /** Base64 image data, with or without a data: URI prefix. */
  imageBase64: z.string().min(1),
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
});

/** Strip a leading `data:image/...;base64,` prefix if present. */
function stripDataUri(s: string): string {
  const comma = s.indexOf(",");
  return s.startsWith("data:") && comma !== -1 ? s.slice(comma + 1) : s;
}

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await extractMeasurements(
      stripDataUri(parsed.imageBase64),
      parsed.mediaType as ImageMediaType,
    );
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
