"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { Service } from "@/types/api";

export function useServicesQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.services,
    queryFn: async () => {
      const response = await api.get<{ success: boolean; services: Service[] }>("/services");
      return response.data.services;
    },
    enabled: isAuthenticated,
  });
}
