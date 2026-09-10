import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { promptTargetSchema } from "@/lib/contracts";
import { finalizeIdea } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const input = z.object({ target: promptTargetSchema, includeExtensions: z.boolean().default(false) }).parse(await request.json());
    return NextResponse.json(await finalizeIdea({ ideaId: (await params).id, ...input }));
  } catch (error) {
    return errorResponse(error);
  }
}

