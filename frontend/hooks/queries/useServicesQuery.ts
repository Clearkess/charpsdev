"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { Service } from "@/types/api";

/**
 * Lists active services, optionally filtered to a single category.
 * Pass `null`/`undefined` for `categoryId` to fetch the full catalog.
 */
export function useServicesQuery(categoryId?: number | null) {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.servicesByCategory(categoryId ?? null),
    queryFn: async () => {
      const response = await api.get<{ success: boolean; services: Service[] }>("/services", {
        params: categoryId ? { category_id: categoryId } : undefined,
      });
      return response.data.services;
    },
    enabled: isAuthenticated,
  });
}
