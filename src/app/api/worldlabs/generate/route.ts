import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateWorld } from "@/lib/clients/worldLabsClient";

const Body = z
  .object({
    imageUrls: z.array(z.string()).optional(),
    videoUrl: z.string().optional(),
  })
  .refine((b) => (b.imageUrls?.length ?? 0) > 0 || !!b.videoUrl, {
    message: "Provide at least one image or a video",
  });

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const worldId = await generateWorld(parsed);
    return NextResponse.json({ worldId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
