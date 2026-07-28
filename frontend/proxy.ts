import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/services", "/wallet", "/orders", "/notifications", "/profile", "/admin"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password", "/reset-password"];
const ADMIN_PREFIX = "/admin";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("charpsdev_token")?.value;
  const role = request.cookies.get("charpsdev_role")?.value;
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
  matcher: ["/dashboard/:path*", "/services/:path*", "/wallet/:path*", "/orders/:path*", "/notifications/:path*", "/profile/:path*", "/admin/:path*", "/login", "/register", "/forgot-password", "/reset-password"],
};
