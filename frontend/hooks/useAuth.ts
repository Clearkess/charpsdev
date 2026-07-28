"use client";

import { useAuthStore } from "@/store/authStore";
import {
  useLoginMutation,
  useLogoutMutation,
  useMeQuery,
  useRegisterMutation,
} from "@/hooks/queries/useAuthQueries";

/**
 * Drop-in successor to the old React Context `useAuth()`. Backed by the
 * Zustand auth store (state) + React Query mutations (login/register/logout)
 * so components get the same ergonomic API with caching/loading/error
 * handling from React Query "for free".
 */
export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  const me = useMeQuery();
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const logoutMutation = useLogoutMutation();

  // "loading" = we don't yet know whether the visitor is authenticated:
  // either the persisted store hasn't rehydrated, or we have a token but
  // haven't confirmed it against /me yet.
  const loading = !hasHydrated || (Boolean(token) && !user && me.isPending);

  return {
    user,
    token,
    loading,
    login: (email: string, password: string) => loginMutation.mutateAsync({ email, password }),
    register: (name: string, email: string, password: string, password_confirmation: string) =>
      registerMutation.mutateAsync({ name, email, password, password_confirmation }),
    logout: () => logoutMutation.mutateAsync(),
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
