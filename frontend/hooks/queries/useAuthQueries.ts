"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, extractErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { ApiResponse, LoginResponse, User } from "@/types/api";

/** Fetches the current user. Only enabled once a token exists (post-hydration) to avoid a guaranteed 401 on first paint. */
export function useMeQuery() {
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const setUser = useAuthStore((state) => state.setUser);

  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      const response = await api.get<ApiResponse<User>>("/me");
      const user = response.data.data;
      setUser(user);
      return user;
    },
    enabled: hasHydrated && Boolean(token),
    retry: false,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await api.post<ApiResponse<LoginResponse>>("/login", { email, password });
      return response.data.data;
    },
    // Must be `async`/awaited (not fire-and-forget): `setSession` returns the
    // promise for the `POST /api/auth/session` call that actually writes the
    // HttpOnly session cookie server-side. TanStack Query awaits `onSuccess`
    // only if it returns a promise — previously this callback called
    // `setSession` without awaiting/returning it, so `mutateAsync()` (and
    // therefore `LoginForm`'s `await login(...)`) resolved before the cookie
    // request had actually completed. That raced against the immediate
    // `router.push("/dashboard")`: the SSR-aware dashboard layout
    // (app/(dashboard)/layout.tsx) checks for that exact cookie via
    // next/headers before rendering, so a fresh login could bounce straight
    // back to /login if the cookie hadn't landed yet by the time the
    // /dashboard request went out. Confirmed via a live Playwright repro
    // against production before this fix (network trace showed the
    // `/dashboard` request firing before the `/api/auth/session` response).
    onSuccess: async ({ token, user }) => {
      queryClient.setQueryData(queryKeys.me, user);
      await setSession(token, user);
    },
  });
}

export function useRegisterMutation() {
  const login = useLoginMutation();

  return useMutation({
    mutationFn: async (payload: { name: string; email: string; password: string; password_confirmation: string }) => {
      await api.post("/register", payload);
      return login.mutateAsync({ email: payload.email, password: payload.password });
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  const clearSession = useAuthStore((state) => state.clearSession);
  const token = useAuthStore((state) => state.token);

  return useMutation({
    mutationFn: async () => {
      if (token) {
        try {
          await api.post("/logout");
        } catch {
          // Ignore network/auth errors on logout — we clear local session regardless.
        }
      }
    },
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async (email: string) => {
      const response = await api.post<{ message?: string }>("/forgot-password", { email });
      return response.data.message || "Password reset link sent.";
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: async (payload: { email: string; token: string; password: string; password_confirmation: string }) => {
      const response = await api.post<{ message?: string }>("/reset-password", payload);
      return response.data.message || "Password reset complete.";
    },
  });
}

export { extractErrorMessage };
