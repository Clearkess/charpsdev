import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ROLE_COOKIE_NAME, TOKEN_COOKIE_NAME } from "@/lib/authCookieNames";

// "/services" and "/virtual-numbers" are intentionally NOT protected here
// (Top-3-Fixes, Fix 2): both now render a real public page for anonymous
// visitors/crawlers, with the full authenticated experience layered on top
// client-side once a session exists. See app/(dashboard)/services/page.tsx.
const PROTECTED_PREFIXES = ["/dashboard", "/wallet", "/orders", "/notifications", "/profile", "/admin"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];
const ADMIN_PREFIX = "/admin";

export function proxy(request: NextRequest) {
  // Cookie names: `__Host-`-prefixed in production (see lib/authCookieNames.ts
  // for why). Reading `request.cookies.get()` works identically whether the
  // cookie is HttpOnly or not — HttpOnly only hides a cookie from client-side
  // `document.cookie`, not from the raw `Cookie:` request header this Edge
  // middleware reads server-side.
  const token = request.cookies.get(TOKEN_COOKIE_NAME)?.value;
  const role = request.cookies.get(ROLE_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAuthPage = AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));
  const isAdminRoute = pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);

  if (isProtected && !token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Edge-level role gating: non-admins (or unknown role, e.g. not yet synced) are
  // redirected away from /admin/* before the route ever renders. This complements
  // (does not replace) the client-side AdminGuard, which still guards against stale
  // cookies/role changes mid-session.
  if (isAdminRoute && token && role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/wallet/:path*", "/orders/:path*", "/notifications/:path*", "/profile/:path*", "/admin/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
