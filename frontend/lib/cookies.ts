export const TOKEN_COOKIE = "charpsdev_token";
export const ROLE_COOKIE = "charpsdev_role";

const SEVEN_DAYS = 60 * 60 * 24 * 7;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string | null, maxAge = SEVEN_DAYS) {
  if (typeof document === "undefined") return;
  if (!value) {
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
    return;
  }
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`;
}

/** Sanctum bearer token, mirrored into a cookie only so the Next.js middleware can see auth state at the edge. */
export function setTokenCookie(token: string | null) {
  writeCookie(TOKEN_COOKIE, token);
}

export function getTokenCookie(): string | null {
  return readCookie(TOKEN_COOKIE);
}

/** Role hint ("admin" | "user") mirrored into a cookie so middleware can gate /admin/* without an extra request. */
export function setRoleCookie(isAdmin: boolean | null | undefined) {
  writeCookie(ROLE_COOKIE, isAdmin ? "admin" : "user");
}

export function getRoleCookie(): string | null {
  return readCookie(ROLE_COOKIE);
}

export function clearAuthCookies() {
  writeCookie(TOKEN_COOKIE, null);
  writeCookie(ROLE_COOKIE, null);
}
