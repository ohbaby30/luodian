import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { archiveIdea, getIdea } from "@/lib/repository";
import { snapshot } from "@/lib/workflow";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  try {
    if (!getIdea(id)) return NextResponse.json({ error: "找不到这个想法。" }, { status: 404 });
    return NextResponse.json(snapshot(id));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  try {
    archiveIdea(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

