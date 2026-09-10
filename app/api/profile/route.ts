import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { getSettings, saveProfile } from "@/lib/repository";

export const runtime = "nodejs";

const profileInput = z.object({
  principles: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
  constraints: z.array(z.string()).default([]),
  doNotDo: z.array(z.string()).default([]),
  defaultContext: z.string().default(""),
});

export function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  return NextResponse.json({ profile: getSettings().profile });
}

export async function PUT(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    return NextResponse.json({ profile: saveProfile(profileInput.parse(await request.json())) });
  } catch (error) {
    return errorResponse(error);
  }
}

