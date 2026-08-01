"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { ApiResponse, Review, ReviewsResponse } from "@/types/api";

/** Phase 9 (user-facing features): reviews/ratings for a single service. */
export function useServiceReviewsQuery(serviceId: number | null) {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.serviceReviews(serviceId ?? 0),
    queryFn: async () => {
      const response = await api.get<ApiResponse<ReviewsResponse>>(`/services/${serviceId}/reviews`);
      return response.data.data;
    },
    enabled: isAuthenticated && serviceId != null,
  });
}

/**
 * Submits (or, if the user already reviewed this service, updates in place)
 * a rating/comment. The backend rejects with 403 if the user has no
 * completed order for this service — surfaced via the mutation's error so
 * the calling component can render the exact server message.
 */
export function useSubmitReviewMutation(serviceId: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { rating: number; comment?: string }) => {
      const response = await api.post<ApiResponse<Review>>(`/services/${serviceId}/reviews`, payload);
      return response.data;
    },
    onSuccess: () => {
      if (serviceId != null) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.serviceReviews(serviceId) });
      }
      // Refresh the catalog too, since reviews_avg_rating/reviews_count on
      // every Service card comes from the same services list.
      void queryClient.invalidateQueries({ queryKey: queryKeys.services });
    },
  });
}
