import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { testProvider } from "@/lib/llm";
import { getSettings, saveProviderSettings } from "@/lib/repository";

export const runtime = "nodejs";

const providerInput = z.object({
  providerBaseUrl: z.string().url(),
  providerModel: z.string().min(1),
  providerApiKey: z.string().optional(),
});

export function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  const settings = getSettings();
  return NextResponse.json({
    providerBaseUrl: settings.providerBaseUrl || "",
    providerModel: settings.providerModel || "",
    hasApiKey: Boolean(settings.providerApiKey),
  });
}

export async function PUT(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const input = providerInput.parse(await request.json());
    saveProviderSettings(input);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const input = providerInput.parse(await request.json());
    const current = getSettings();
    const testSettings = {
      ...current,
      providerBaseUrl: input.providerBaseUrl,
      providerModel: input.providerModel,
      providerApiKey: input.providerApiKey?.trim() || current.providerApiKey,
    };
    await testProvider(testSettings);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

