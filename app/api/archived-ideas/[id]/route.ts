import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { deleteArchivedIdea } from "@/lib/repository";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await params;
    if (!deleteArchivedIdea(id)) return NextResponse.json({ error: "找不到这条已归档想法。" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
