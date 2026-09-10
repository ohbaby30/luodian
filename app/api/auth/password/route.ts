import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { changePassword } from "@/lib/password";
import { getSettings, saveAdminPasswordHash } from "@/lib/repository";

export const runtime = "nodejs";

const passwordInput = z.object({
  currentPassword: z.string().min(1, "请输入当前密码。"),
  newPassword: z.string().min(8, "新密码至少需要 8 位。"),
  confirmPassword: z.string().min(8, "请再次输入至少 8 位的新密码。"),
}).superRefine((value, context) => {
  if (value.newPassword !== value.confirmPassword) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["confirmPassword"], message: "两次输入的新密码不一致。" });
  }
});

export async function PUT(request: NextRequest) {
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const input = passwordInput.parse(await request.json());
    const nextHash = await changePassword({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
      currentHash: getSettings().adminPasswordHash,
    });
    saveAdminPasswordHash(nextHash);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
