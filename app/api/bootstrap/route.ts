import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getSettings, listIdeas } from "@/lib/repository";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const settings = getSettings();
  const authenticated = isAuthenticated(request);
  return NextResponse.json({
    initialized: Boolean(settings.adminPasswordHash),
    authenticated,
    providerConfigured: Boolean(settings.providerBaseUrl && settings.providerModel && settings.providerApiKey),
    profile: authenticated ? settings.profile : null,
    ideas: authenticated ? listIdeas() : [],
  });
}

