import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { attachSession } from "@/lib/auth";
import { verifyPassword } from "@/lib/crypto";
import { errorResponse } from "@/lib/http";
import { getSettings } from "@/lib/repository";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { password } = z.object({ password: z.string().min(1) }).parse(await request.json());
    const settings = getSettings();
    if (!settings.adminPasswordHash || !(await verifyPassword(password, settings.adminPasswordHash))) {
      return NextResponse.json({ error: "密码不正确。" }, { status: 401 });
    }
    return attachSession(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}

