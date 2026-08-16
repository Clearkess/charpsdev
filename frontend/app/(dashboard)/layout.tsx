import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import { TOKEN_COOKIE_NAME } from "@/lib/authCookieNames";

/**
 * Server Component layout (Top-3-Fixes, Fix 2: SSR-aware /dashboard auth
 * check). Reads the HttpOnly session cookie directly here, server-side,
 * via next/headers `cookies()` — this is the same cookie proxy.ts's Edge
 * middleware already checks (see lib/authCookieNames.ts), so this is not a
 * new source of truth, just an earlier check in the same request.
 *
 * Previously the *only* auth check for this route group was client-side
 * (ProtectedRoute), which always renders a "Loading your workspace..."
 * spinner on first paint — even for an already-logged-in visitor with a
 * valid cookie — because the client has to rehydrate Zustand from
 * localStorage and/or await `/me` before it can know `user` is non-null.
 * That flash is pure overhead for the common case (a real cookie already
 * present) and is now skipped entirely: if there's no session cookie at
 * all, we redirect to /login before any client JS runs, so an anonymous
 * visitor never even receives the dashboard shell/spinner.
 *
 * ProtectedRoute is intentionally kept as an inner client-side guard, not
 * removed: the localStorage-persisted bearer token and the `/me` call are
 * still the actual source of truth for `lib/api.ts`'s Authorization
 * header — this cookie is only ever a mirror used for Edge/SSR
 * route-admission checks (see app/api/auth/session/route.ts). A cookie
 * can in rare cases be stale/revoked (e.g. token invalidated server-side)
 * even though it's present, so ProtectedRoute's redirect-to-/login effect
 * still runs as a safety net once `/me` settles.
 *
 * What changes is *how* ProtectedRoute behaves while that client-side
 * check is still in flight: since we already know a session cookie was
 * present for this request, we tell it to skip the blocking
 * "Loading your workspace..." spinner (`skipLoadingScreen`) and render
 * the dashboard shell/content optimistically instead — eliminating the
 * flash for the overwhelmingly common case of an already-logged-in
 * visitor waiting on client rehydration.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const hasSessionCookie = Boolean(cookieStore.get(TOKEN_COOKIE_NAME)?.value);

  if (!hasSessionCookie) {
    redirect(`/login?next=${encodeURIComponent("/dashboard")}`);
  }

  return (
    <ProtectedRoute skipLoadingScreen>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}
