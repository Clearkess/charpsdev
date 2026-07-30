"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { Category } from "@/types/api";

export function useCategoriesQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Category[] }>("/categories");
      return response.data.data;
    },
    enabled: isAuthenticated,
  });
}
