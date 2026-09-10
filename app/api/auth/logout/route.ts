import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

export const runtime = "nodejs";

export function POST() {
  return clearSession(NextResponse.json({ ok: true }));
}

