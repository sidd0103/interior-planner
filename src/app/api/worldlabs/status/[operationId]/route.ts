import { NextResponse } from "next/server";
import { getOperation } from "@/lib/clients/worldLabsClient";

export async function GET(_req: Request, ctx: { params: Promise<{ operationId: string }> }) {
  const { operationId } = await ctx.params;
  try {
    const op = await getOperation(operationId);
    return NextResponse.json({
      status: op.error ? "error" : op.done ? "done" : "processing",
      splatReady: !!op.splatUrl,
      error: op.error,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
