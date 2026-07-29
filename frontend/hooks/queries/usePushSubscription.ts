"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuthStore } from "@/store/authStore";
import type { ApiResponse, SimpleMessageResponse } from "@/types/api";

/** Whether the current browser can support Web Push at all (SSR-safe). */
export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function usePushPublicKeyQuery() {
  const isAuthenticated = useAuthStore((state) => Boolean(state.token));

  return useQuery({
    queryKey: queryKeys.pushPublicKey,
    queryFn: async () => {
      const response = await api.get<ApiResponse<{ publicKey: string | null }>>("/push/public-key");
      return response.data.data.publicKey;
    },
    enabled: isAuthenticated,
    staleTime: Infinity,
  });
}

function useSubscribeMutation() {
  return useMutation({
    mutationFn: async (subscription: PushSubscriptionJSON) => {
      const response = await api.post<SimpleMessageResponse>("/push/subscribe", {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        contentEncoding: "aes128gcm",
      });
      return response.data;
    },
  });
}

function useUnsubscribeMutation() {
  return useMutation({
    mutationFn: async (endpoint: string) => {
      const response = await api.post<SimpleMessageResponse>("/push/unsubscribe", { endpoint });
      return response.data;
    },
  });
}

/**
 * Drives the "enable push notifications" toggle: registers the service
 * worker, requests permission, subscribes/unsubscribes with the Push API,
 * and syncs the subscription with the backend.
 */
export function usePushSubscription() {
  const supported = isPushSupported();
  const publicKeyQuery = usePushPublicKeyQuery();
  const subscribeMutation = useSubscribeMutation();
  const unsubscribeMutation = useUnsubscribeMutation();

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    supported ? Notification.permission : "unsupported"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setIsSubscribed(Boolean(existing));
        }
      } catch {
        // Service worker registration failing is non-fatal; toggle simply stays off.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supported]);

  const subscribe = useCallback(async () => {
    setError(null);

    if (!supported) {
      setError("Push notifications are not supported in this browser.");
      return;
    }

    if (!publicKeyQuery.data) {
      setError("Push notifications are not configured on the server yet.");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setError("Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKeyQuery.data),
      });

      await subscribeMutation.mutateAsync(subscription.toJSON());
      setIsSubscribed(true);
    } catch {
      setError("Failed to enable push notifications.");
    }
  }, [publicKeyQuery.data, subscribeMutation, supported]);

  const unsubscribe = useCallback(async () => {
    setError(null);

    if (!supported) return;

    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();

      if (subscription) {
        await unsubscribeMutation.mutateAsync(subscription.endpoint);
        await subscription.unsubscribe();
      }

      setIsSubscribed(false);
    } catch {
      setError("Failed to disable push notifications.");
    }
  }, [supported, unsubscribeMutation]);

  return {
    supported,
    permission,
    isSubscribed,
    checking,
    error,
    subscribe,
    unsubscribe,
    isPending: subscribeMutation.isPending || unsubscribeMutation.isPending || publicKeyQuery.isPending,
  };
}
