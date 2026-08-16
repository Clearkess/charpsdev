"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Category } from "@/types/api";

/**
 * `GET /categories` is a public, read-only endpoint (see backend
 * routes/api.php — Top-3-Fixes Fix 2), so this fetches regardless of
 * auth state to support the public `/services` catalogue page.
 */
export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: Category[] }>("/categories");
      return response.data.data;
    },
  });
}
