import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { delegateAndAnalyze } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const input = z.object({ turnId: z.string().uuid() }).parse(await request.json());
    return NextResponse.json(await delegateAndAnalyze((await params).id, input.turnId));
  } catch (error) {
    return errorResponse(error);
  }
}
