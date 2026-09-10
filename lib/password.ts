import { hashPassword, verifyPassword } from "./crypto";

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  currentHash: string | null;
}): Promise<string> {
  if (!input.currentHash || !(await verifyPassword(input.currentPassword, input.currentHash))) {
    throw new Error("当前密码不正确。");
  }
  return hashPassword(input.newPassword);
}
