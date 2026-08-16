import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { setAuthToken } from "@/lib/api";
import { clearSessionCookie, setSessionCookie } from "@/lib/cookies";
import type { User } from "@/types/api";

type AuthState = {
  user: User | null;
  token: string | null;
  /** True until the initial /me bootstrap call (on app load) has settled. */
  hasHydrated: boolean;
  setSession: (token: string, user: User) => Promise<void>;
  setUser: (user: User | null) => Promise<void> | void;
  clearSession: () => Promise<void>;
  markHydrated: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      hasHydrated: false,
      setSession: (token, user) => {
        setAuthToken(token);
        set({ token, user });
        // Fire-and-forget: the HttpOnly cookie write happens server-side and
        // is not awaited here. Client state (used by the UI + lib/api.ts's
        // Authorization header) is already correct synchronously above;
        // TanStack Query does await this mutation's onSuccess (see
        // useLoginMutation), so callers using mutateAsync still only
        // resolve once this promise settles if they await setSession —
        // we return the promise so they can if they choose to.
        return setSessionCookie(token, user.is_admin);
      },
      setUser: async (user) => {
        set({ user });
        const token = get().token;
        if (token && user) {
          await setSessionCookie(token, user.is_admin);
        }
      },
      // Must clear the server-side HttpOnly cookie BEFORE flipping local
      // state to null (not after, and not fire-and-forget). ProtectedRoute's
      // redirect effect reacts to `user` becoming null synchronously; if we
      // set local state first, that effect can call router.replace("/login")
      // while the DELETE /api/auth/session request is still in flight. The
      // browser then requests /login while the old cookie is still present,
      // and proxy.ts's isAuthPage+token check (Edge middleware, reads the
      // same cookie) bounces it straight back to /dashboard -> which then
      // redirects to /login again once the cookie finally clears — a visible
      // two-hop redirect loop. Confirmed live via a Playwright network trace
      // against production: DELETE /api/auth/session started, then
      // GET /login fired before it resolved, causing exactly that bounce.
      // Awaiting the cookie clear first (mirrors the useLoginMutation fix in
      // hooks/queries/useAuthQueries.ts, same race in the opposite direction)
      // ensures proxy.ts never sees a stale cookie once the redirect fires.
      clearSession: async () => {
        await clearSessionCookie();
        setAuthToken(null);
        set({ token: null, user: null });
      },
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "charpsdev-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state, error) => {
        // Re-apply the persisted token to axios + the HttpOnly session
        // cookie as soon as the persisted slice is read back from
        // localStorage on the client (e.g. after a hard refresh).
        if (!error && state?.token) {
          setAuthToken(state.token);
          void setSessionCookie(state.token, state.user?.is_admin);
        }
        state?.markHydrated();
      },
    },
  ),
);

export const authSelectors = {
  isAuthenticated: (state: AuthState) => Boolean(state.user && state.token),
  isAdmin: (state: AuthState) => Boolean(state.user?.is_admin),
};
