import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { attachSession } from "@/lib/auth";
import { hashPassword } from "@/lib/crypto";
import { errorResponse } from "@/lib/http";
import { getSettings, saveInitialSettings } from "@/lib/repository";

export const runtime = "nodejs";

const setupSchema = z.object({
  password: z.string().min(8, "访问密码至少需要 8 位。"),
  providerBaseUrl: z.string().url("AI 接口地址必须是完整 URL。"),
  providerModel: z.string().min(1, "请填写模型名称。"),
  providerApiKey: z.string().min(1, "请填写 API Key。"),
});

export async function POST(request: NextRequest) {
  try {
    const current = getSettings();
    if (current.adminPasswordHash) return NextResponse.json({ error: "落点已经完成初始化。" }, { status: 409 });
    const input = setupSchema.parse(await request.json());
    saveInitialSettings({
      adminPasswordHash: await hashPassword(input.password),
      providerBaseUrl: input.providerBaseUrl,
      providerModel: input.providerModel,
      providerApiKey: input.providerApiKey,
    });
    return attachSession(NextResponse.json({ ok: true }));
  } catch (error) {
    return errorResponse(error);
  }
}

