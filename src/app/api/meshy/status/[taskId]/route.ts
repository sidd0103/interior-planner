import { NextResponse } from "next/server";
import { getTask } from "@/lib/clients/meshyClient";

export async function GET(_req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await ctx.params;
  try {
    const task = await getTask(taskId);
    return NextResponse.json({
      status: task.status,
      progress: task.progress,
      glbReady: !!task.modelUrls.glb,
      error: task.error,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
