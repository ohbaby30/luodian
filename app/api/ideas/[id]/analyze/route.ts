import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { analyzeAndPersist } from "@/lib/workflow";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json(await analyzeAndPersist((await params).id));
  } catch (error) {
    return errorResponse(error);
  }
}

