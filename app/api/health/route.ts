import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export function GET() {
  getDb().prepare("SELECT 1 AS ok").get();
  return NextResponse.json({ ok: true, service: "luodian" });
}

