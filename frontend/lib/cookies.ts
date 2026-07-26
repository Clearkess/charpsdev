const COOKIE_NAME = "charpsdev_token";

export function setTokenCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (!token) {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
    return;
  }
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
}
