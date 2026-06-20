import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prepareUpload } from "@/lib/clients/worldLabsClient";

const Body = z.object({
  fileName: z.string().min(1),
  kind: z.enum(["image", "video"]),
  extension: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const prepared = await prepareUpload(parsed.fileName, parsed.kind, parsed.extension);
    return NextResponse.json(prepared);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
