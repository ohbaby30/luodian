import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { testProvider } from "@/lib/llm";
import {
  isProviderConfigured,
  normalizeProviderOptions,
  normalizeProviderProfile,
  providerKindSchema,
  type ProviderKind,
} from "@/lib/provider";
import { getSettings, providerProfilesForSettings, saveProviderProfiles, saveProviderSettings } from "@/lib/repository";

export const runtime = "nodejs";

const providerOptionsSchema = z.object({
  authMode: z.enum(["auto", "bearer", "api-key", "x-api-key"]).optional(),
  tokenMode: z.enum(["auto", "max_tokens", "max_completion_tokens"]).optional(),
  jsonMode: z.enum(["auto", "enabled", "disabled"]).optional(),
  thinkingMode: z.enum(["auto", "enabled", "disabled"]).optional(),
});

const providerProfileInput = z.object({
  providerBaseUrl: z.union([z.literal(""), z.string().url("AI 接口地址必须是完整 URL。").default("")]),
  providerModel: z.string().default(""),
  providerApiKey: z.string().optional(),
  providerOptions: providerOptionsSchema.optional(),
});

const providerInput = z.object({
  profiles: z.object({ metered: providerProfileInput.optional(), plan: providerProfileInput.optional() }).optional(),
  providerKind: providerKindSchema.optional(),
  profile: providerProfileInput.optional(),
  providerBaseUrl: z.string().url().optional(),
  providerModel: z.string().min(1).optional(),
  providerApiKey: z.string().optional(),
  providerOptions: providerOptionsSchema.optional(),
});

function profileView(profile: ReturnType<typeof normalizeProviderProfile>) {
  return {
    providerBaseUrl: profile.providerBaseUrl,
    providerModel: profile.providerModel,
    hasApiKey: Boolean(profile.providerApiKey),
    configured: isProviderConfigured(profile),
    providerOptions: profile.providerOptions,
  };
}

export function GET(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  const settings = getSettings();
  const profiles = settings.providerProfiles;
  return NextResponse.json({
    providerBaseUrl: settings.providerBaseUrl || "",
    providerModel: settings.providerModel || "",
    hasApiKey: Boolean(settings.providerApiKey),
    providerOptions: settings.providerOptions,
    profiles: {
      metered: profileView(profiles?.metered ?? normalizeProviderProfile(null)),
      plan: profileView(profiles?.plan ?? normalizeProviderProfile(null)),
    },
  });
}

export async function PUT(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const input = providerInput.parse(await request.json());
    if (input.profiles) {
      saveProviderProfiles(input.profiles);
    } else if (input.providerBaseUrl && input.providerModel) {
      saveProviderSettings({
        providerBaseUrl: input.providerBaseUrl,
        providerModel: input.providerModel,
        providerApiKey: input.providerApiKey,
        providerOptions: input.providerOptions,
        providerKind: input.providerKind,
      });
    } else {
      throw new Error("至少需要提交一组完整的 AI 接口配置。");
    }
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
    const providerKind: ProviderKind = input.providerKind ?? "metered";
    const currentProfiles = providerProfilesForSettings(current);
    const currentProfile = currentProfiles[providerKind];
    const profile = input.profile ?? {
      providerBaseUrl: input.providerBaseUrl || "",
      providerModel: input.providerModel || "",
      providerApiKey: input.providerApiKey,
      providerOptions: input.providerOptions,
    };
    const testSettings = {
      ...current,
      providerProfiles: {
        ...currentProfiles,
        [providerKind]: {
          ...normalizeProviderProfile(profile),
          providerApiKey: profile.providerApiKey?.trim() || currentProfile.providerApiKey,
          providerOptions: normalizeProviderOptions({ ...currentProfile.providerOptions, ...profile.providerOptions }),
        },
      },
    };
    await testProvider(testSettings, providerKind);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
