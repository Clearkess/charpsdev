"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { Service } from "@/types/api";

/**
 * Lists active services, optionally filtered to a single category.
 * Pass `null`/`undefined` for `categoryId` to fetch the full catalog.
 *
 * `GET /services` is a public, read-only endpoint (see backend
 * routes/api.php — Top-3-Fixes Fix 2), so this intentionally fetches
 * regardless of auth state: the `/services` page now renders a real
 * public catalogue for anonymous visitors/crawlers, not just logged-in
 * users.
 */
export function useServicesQuery(categoryId?: number | null) {
  return useQuery({
    queryKey: queryKeys.servicesByCategory(categoryId ?? null),
    queryFn: async () => {
      const response = await api.get<{ success: boolean; services: Service[] }>("/services", {
        params: categoryId ? { category_id: categoryId } : undefined,
      });
      return response.data.services;
    },
  });
}
