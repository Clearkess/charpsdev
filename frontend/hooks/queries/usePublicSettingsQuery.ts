"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import type { ApiResponse, PublicSettings } from "@/types/api";

/**
 * Unauthenticated, admin-editable contact info (currently just
 * support_email) for the Support page. `staleTime: Infinity` since this
 * almost never changes and there's no invalidation path from the admin
 * Settings page for it — a hard refresh picks up any edit.
 */
export function usePublicSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.publicSettings,
    queryFn: async () => {
      const response = await api.get<ApiResponse<PublicSettings>>("/settings/public");
      return response.data.data;
    },
    staleTime: Infinity,
  });
}
