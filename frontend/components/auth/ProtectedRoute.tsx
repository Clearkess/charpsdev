"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function ProtectedRoute({
  children,
  skipLoadingScreen = false,
}: {
  children: React.ReactNode;
  /**
   * Pass `true` when a parent Server Component has already confirmed a
   * valid session cookie exists for this request (Top-3-Fixes, Fix 2 —
   * see app/(dashboard)/layout.tsx). In that case the visitor is
   * overwhelmingly likely to be a real logged-in user who's merely waiting
   * on client-side rehydration (Zustand from localStorage + the /me
   * confirmation call), so we render `children` optimistically instead of
   * the blocking "Loading your workspace..." spinner. If the cookie turns
   * out to be stale/revoked (rare — e.g. token invalidated server-side),
   * the effect below still fires its redirect-to-/login once `loading`
   * settles to `false` with no `user`, exactly as before.
   */
  skipLoadingScreen?: boolean;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    if (skipLoadingScreen) {
      return <>{children}</>;
    }
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
        Loading your workspace...
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
