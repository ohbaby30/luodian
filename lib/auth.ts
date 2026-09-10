import { NextRequest, NextResponse } from "next/server";
import { signSession, verifySession } from "./crypto";

export const SESSION_COOKIE = "luodian_session";

export function isAuthenticated(request: NextRequest): boolean {
  return verifySession(request.cookies.get(SESSION_COOKIE)?.value);
}

export function requireAuth(request: NextRequest): NextResponse | null {
  if (isAuthenticated(request)) return null;
  return NextResponse.json({ error: "请先登录落点。" }, { status: 401 });
}

export function attachSession(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: signSession({ exp: Date.now() + 1000 * 60 * 60 * 24 * 14 }),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}

export function clearSession(response: NextResponse): NextResponse {
  response.cookies.set({ name: SESSION_COOKIE, value: "", expires: new Date(0), path: "/" });
  return response;
}

