import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { deleteAllArchivedIdeas, listArchivedIdeas } from "@/lib/repository";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ ideas: listArchivedIdeas() });
}

export function DELETE(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ ok: true, deletedCount: deleteAllArchivedIdeas() });
  } catch (error) {
    return errorResponse(error);
  }
}
