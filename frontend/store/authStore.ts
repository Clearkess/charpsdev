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
  setSession: (token: string, user: User) => void;
  setUser: (user: User | null) => void;
  clearSession: () => void;
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
      setUser: (user) => {
        set({ user });
        const token = get().token;
        if (token && user) {
          return setSessionCookie(token, user.is_admin);
        }
      },
      clearSession: () => {
        setAuthToken(null);
        set({ token: null, user: null });
        return clearSessionCookie();
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
