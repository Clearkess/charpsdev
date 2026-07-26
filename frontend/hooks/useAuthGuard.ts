"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";

export function useAuthGuard() {
  const { user, token, loading } = useAuth();

  return useMemo(
    () => ({
      authenticated: Boolean(user && token),
      isAdmin: Boolean(user?.is_admin),
      user,
      loading,
    }),
    [user, token, loading],
  );
}
