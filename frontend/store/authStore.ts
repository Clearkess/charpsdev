import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { setAuthToken } from "@/lib/api";
import { clearAuthCookies, setRoleCookie, setTokenCookie } from "@/lib/cookies";
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
    (set) => ({
      user: null,
      token: null,
      hasHydrated: false,
      setSession: (token, user) => {
        setAuthToken(token);
        setTokenCookie(token);
        setRoleCookie(user.is_admin);
        set({ token, user });
      },
      setUser: (user) => {
        setRoleCookie(user?.is_admin);
        set({ user });
      },
      clearSession: () => {
        setAuthToken(null);
        clearAuthCookies();
        set({ token: null, user: null });
      },
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "charpsdev-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state, error) => {
        // Re-apply the persisted token to axios + cookies as soon as the
        // persisted slice is read back from localStorage on the client.
        if (!error && state?.token) {
          setAuthToken(state.token);
          setTokenCookie(state.token);
          setRoleCookie(state.user?.is_admin);
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
