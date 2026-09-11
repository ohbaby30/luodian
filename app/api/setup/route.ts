import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { attachSession } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { errorResponse } from "@/lib/http";
import { isProviderConfigured, normalizeProviderProfile } from "@/lib/provider";
import { getSettings, saveInitialSettings } from "@/lib/repository";

export const runtime = "nodejs";

const providerProfileInput = z.object({
  providerBaseUrl: z.union([z.literal(""), z.string().url("AI 接口地址必须是完整 URL。").default("")]),
  providerModel: z.string().default(""),
  providerApiKey: z.string().optional(),
  providerOptions: z.object({
    authMode: z.enum(["auto", "bearer", "api-key", "x-api-key"]).optional(),
    tokenMode: z.enum(["auto", "max_tokens", "max_completion_tokens"]).optional(),
    jsonMode: z.enum(["auto", "enabled", "disabled"]).optional(),
    thinkingMode: z.enum(["auto", "enabled", "disabled"]).optional(),
  }).optional(),
});

const setupSchema = z.object({
  password: z.string().min(8, "访问密码至少需要 8 位。"),
  profiles: z.object({ metered: providerProfileInput.optional(), plan: providerProfileInput.optional() }).optional(),
  providerBaseUrl: z.string().url("AI 接口地址必须是完整 URL。").optional(),
  providerModel: z.string().min(1, "请填写模型名称。").optional(),
  providerApiKey: z.string().min(1, "请填写 API Key。").optional(),
  providerOptions: providerProfileInput.shape.providerOptions,
}).superRefine((value, context) => {
  if (value.profiles) {
    const hasConfiguredProfile = [value.profiles.metered, value.profiles.plan]
      .some((profile) => profile && isProviderConfigured(normalizeProviderProfile(profile)));
    if (!hasConfiguredProfile) context.addIssue({ code: z.ZodIssueCode.custom, path: ["profiles"], message: "至少需要填写一组完整的 AI 接口配置。" });
    return;
  }
  if (!value.providerBaseUrl || !value.providerModel || !value.providerApiKey) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["providerBaseUrl"], message: "请填写一组完整的 AI 接口配置。" });
  }
});

export async function POST(request: NextRequest) {
  try {
    const current = getSettings();
    if (current.adminPasswordHash) return NextResponse.json({ error: "落点已经完成初始化。" }, { status: 409 });
    const input = setupSchema.parse(await request.json());
    saveInitialSettings(input.profiles
      ? { adminPasswordHash: await hashPassword(input.password), providerProfiles: input.profiles }
      : {
        adminPasswordHash: await hashPassword(input.password),
        providerBaseUrl: input.providerBaseUrl,
        providerModel: input.providerModel,
        providerApiKey: input.providerApiKey,
        providerOptions: input.providerOptions,
      });
    return attachSession(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}
