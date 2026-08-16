"use client";

import AppLayout from "@/components/layout/AppLayout";
import PublicSiteHeader from "@/components/layout/PublicSiteHeader";
import AuthenticatedServicesView from "@/components/services/AuthenticatedServicesView";
import PublicServicesView from "@/components/services/PublicServicesView";
import { useAuth } from "@/hooks/useAuth";

/**
 * Dual-mode /services page (Top-3-Fixes, Fix 2).
 *
 * Moved out of app/(dashboard)/services — that route group's layout wraps
 * everything in <ProtectedRoute>, which renders nothing (then redirects to
 * /login) for anonymous visitors, making the page invisible to search
 * crawlers. This top-level route instead renders unconditionally and picks
 * the view based on auth state:
 *   - Signed in: AuthenticatedServicesView, wrapped in the same AppLayout
 *     sidebar/topbar chrome every other authenticated route uses — the
 *     existing full cart-integrated experience (search, category filters,
 *     add-to-cart), unchanged from the previous
 *     app/(dashboard)/services page.
 *   - No session (or still resolving on first paint): PublicServicesView —
 *     a real, indexable catalogue with categories + sample plans and
 *     register/login CTAs. This is also exactly what a cookie-less
 *     crawler request renders, since it never observes a logged-in state.
 *
 * Both views share the same underlying public `useServicesQuery`/
 * `useCategoriesQuery` data (see backend routes/api.php, commit fd91d29),
 * so there's no duplicate data-fetching logic — only the presentation and
 * interaction model differ.
 */
export default function ServicesPage() {
  const { user, loading } = useAuth();

  // While auth is still resolving (pre-hydration / awaiting `/me`), default
  // to the public view rather than a loading spinner — this is also
  // exactly what a cookie-less crawler request renders, and it avoids
  // introducing a second "loading" state distinct from ProtectedRoute's
  // (which this route intentionally does not use).
  if (!loading && user) {
    return (
      <AppLayout>
        <AuthenticatedServicesView />
      </AppLayout>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicSiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <PublicServicesView />
      </main>
    </div>
  );
}
