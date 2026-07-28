import axios, { AxiosError } from "axios";
import { API_URL } from "@/lib/constants";
import { getTokenCookie } from "@/lib/cookies";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

// Keep every request's Authorization header in sync with the persisted token,
// even across tabs/reloads, without relying on render order of providers.
api.interceptors.request.use((config) => {
  if (!config.headers?.Authorization) {
    const token = typeof window !== "undefined" ? getTokenCookie() : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

/**
 * Listeners notified when the API responds 401 (session expired/invalid).
 * The auth store subscribes to this to clear state and redirect to /login,
 * without lib/api.ts needing to import the store (avoids circular imports).
 */
type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

export function onUnauthorized(handler: UnauthorizedHandler) {
  unauthorizedHandlers.add(handler);
  return () => {
    unauthorizedHandlers.delete(handler);
  };
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      unauthorizedHandlers.forEach((handler) => handler());
    }
    return Promise.reject(error);
  },
);

export function extractErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; errors?: Record<string, string[]> } | undefined;
    if (data?.errors) {
      const first = Object.values(data.errors)[0];
      if (first?.[0]) return first[0];
    }
    if (data?.message) return data.message;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
