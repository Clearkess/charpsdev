"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onUnauthorized } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useMeQuery } from "@/hooks/queries/useAuthQueries";

/**
 * Mounted once near the app root. Responsibilities:
 * - Validates the persisted token by calling /me on load (via useMeQuery).
 * - Subscribes to global 401 responses and clears the session + bounces to /login.
 * This keeps lib/api.ts free of store imports (no circular dependency).
 */
export default function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);

  useMeQuery();

  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      const hadSession = Boolean(useAuthStore.getState().token);
      // Await the cookie clear before navigating, same reasoning as
      // useLogoutMutation's onSettled (store/authStore.ts) — otherwise this
      // router.replace can race ahead of the DELETE /api/auth/session
      // request and momentarily bounce through a stale-cookie redirect.
      void clearSession().then(() => {
        if (hadSession && typeof window !== "undefined") {
          router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        }
      });
    });
    return unsubscribe;
  }, [clearSession, router]);

  return <>{children}</>;
}
