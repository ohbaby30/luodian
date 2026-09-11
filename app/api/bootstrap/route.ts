import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { configuredProviderKinds } from "@/lib/provider";
import { getSettings, listArchivedIdeas, listIdeas } from "@/lib/repository";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const settings = getSettings();
  const authenticated = isAuthenticated(request);
  return NextResponse.json({
    initialized: Boolean(settings.adminPasswordHash),
    authenticated,
    providerConfigured: configuredProviderKinds(settings.providerProfiles).length > 0,
    profile: authenticated ? settings.profile : null,
    ideas: authenticated ? listIdeas() : [],
    archivedIdeas: authenticated ? listArchivedIdeas() : [],
  });
}
