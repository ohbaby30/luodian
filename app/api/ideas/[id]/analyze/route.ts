import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { providerKindSchema } from "@/lib/provider";
import { analyzeAndPersist } from "@/lib/workflow";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      // Empty bodies are valid when only one provider is configured.
    }
    const input = z.object({ providerKind: providerKindSchema.optional() }).parse(body);
    return NextResponse.json(await analyzeAndPersist((await params).id, input.providerKind));
  } catch (error) {
    return errorResponse(error);
  }
}
