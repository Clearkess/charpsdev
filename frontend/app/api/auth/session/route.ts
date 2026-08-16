import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROLE_COOKIE_NAME, SESSION_COOKIE_MAX_AGE, TOKEN_COOKIE_NAME } from "@/lib/authCookieNames";

/**
 * Server-side session cookie endpoint (Top-3-Fixes, Fix 3).
 *
 * The Sanctum bearer token itself always lives in the client (Zustand store,
 * persisted to localStorage) — this route does NOT replace that, since
 * lib/api.ts still needs a token it can attach as an `Authorization` header
 * from JS. What this route replaces is the *cookie mirror* of that token:
 * previously `lib/cookies.ts` wrote a plain `document.cookie` (readable by
 * any script on the page), purely so `proxy.ts`'s Edge middleware could see
 * auth state without an extra request. That mirror is now written here, as
 * a `Set-Cookie` response header, so it can be `HttpOnly` (invisible to
 * `document.cookie`/XSS) while still being visible to `proxy.ts`, which
 * reads the raw `Cookie:` request header via `request.cookies.get()` —
 * a capability unaffected by `HttpOnly`.
 *
 * POST { token, isAdmin } -> sets the session cookies.
 * DELETE                  -> clears the session cookies (logout).
 */

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { token?: string; isAdmin?: boolean } | null;
  const token = body?.token;

  if (!token) {
    return NextResponse.json({ success: false, message: "token is required" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(TOKEN_COOKIE_NAME, token, cookieOptions(SESSION_COOKIE_MAX_AGE));
  response.cookies.set(ROLE_COOKIE_NAME, body?.isAdmin ? "admin" : "user", cookieOptions(SESSION_COOKIE_MAX_AGE));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(TOKEN_COOKIE_NAME, "", cookieOptions(0));
  response.cookies.set(ROLE_COOKIE_NAME, "", cookieOptions(0));
  return response;
}
