"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { CountResponse, NotificationItem, PaginatedResponse, SimpleMessageResponse } from "@/types/api";

export function useNotificationsQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<NotificationItem>>("/notifications");
      return response.data;
    },
    enabled: isAuthenticated,
  });
}

export function useUnreadCountQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.unreadCount,
    queryFn: async () => {
      const response = await api.get<CountResponse>("/notifications/unread-count");
      return response.data.count;
    },
    enabled: isAuthenticated,
    refetchInterval: 60 * 1000,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.put<SimpleMessageResponse>(`/notifications/${id}/read`);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      void queryClient.invalidateQueries({ queryKey: queryKeys.unreadCount });
    },
  });
}
