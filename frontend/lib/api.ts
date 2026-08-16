import axios, { AxiosError } from "axios";
import { API_URL } from "@/lib/constants";

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
//
// Fallback token source: the Zustand auth store (persisted to localStorage),
// not a cookie. Previously this read a mirrored `document.cookie` value,
// but that cookie is now HttpOnly (Top-3-Fixes, Fix 3) and therefore
// invisible to client JS by design — the store's `token` field is the
// actual source of truth for the bearer token on the client regardless.
// Imported lazily inside the interceptor (dynamic `import()`, not a
// top-level import) to avoid a circular import, since store/authStore.ts
// itself imports `setAuthToken` from this file. Axios request interceptors
// support returning a Promise, so this stays fully type-safe (no `require`).
api.interceptors.request.use(async (config) => {
  if (!config.headers?.Authorization && typeof window !== "undefined") {
    const { useAuthStore } = await import("@/store/authStore");
    const token = useAuthStore.getState().token;
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
