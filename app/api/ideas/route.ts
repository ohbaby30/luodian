import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { createIdea, listIdeas } from "@/lib/repository";
import { promptTargetSchema } from "@/lib/contracts";

export const runtime = "nodejs";

const createSchema = z.object({ rawText: z.string().min(3, "请先写下至少三字的想法。"), target: promptTargetSchema });

export function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ideas: listIdeas() });
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ idea: createIdea(createSchema.parse(await request.json())) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

