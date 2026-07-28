"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { ApiResponse, User } from "@/types/api";

export function useProfileQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: async () => {
      const response = await api.get<ApiResponse<User>>("/profile");
      return response.data.data;
    },
    enabled: isAuthenticated,
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (payload: { name: string; email: string }) => {
      const response = await api.put<ApiResponse<User>>("/profile", payload);
      return response.data;
    },
    onSuccess: (response) => {
      queryClient.setQueryData(queryKeys.profile, response.data);
      setUser(response.data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}
