import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createImageTo3D } from "@/lib/clients/meshyClient";

const Body = z.object({
  imageUrl: z.string().min(1), // data URI or public URL
  targetPolycount: z.number().int().positive().optional(),
  shouldTexture: z.boolean().optional(),
  enablePbr: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const taskId = await createImageTo3D(parsed);
    return NextResponse.json({ taskId });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
