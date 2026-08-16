/**
 * Client-side helpers for the server-set session cookie (Top-3-Fixes,
 * Fix 3). These no longer touch `document.cookie` directly — the cookie
 * itself is `HttpOnly` (set via `Set-Cookie` by
 * `app/api/auth/session/route.ts`) and therefore invisible to client JS by
 * design. Callers just POST/DELETE to that route; the browser handles
 * storing/sending the resulting cookie automatically.
 *
 * Nothing in the app reads this cookie back on the client (confirmed: no
 * callers of a `getTokenCookie`/`getRoleCookie`-style read exist outside
 * this file previously, and the token itself lives in the Zustand store —
 * see store/authStore.ts and lib/api.ts). The only reader is `proxy.ts`'s
 * Edge middleware, which reads the raw `Cookie:` request header
 * server-side — a path `HttpOnly` does not affect.
 *
 * Both calls are best-effort: if they fail (e.g. offline), the client-side
 * Zustand session still updates normally so the app keeps working; only the
 * Edge middleware's redirect behavior would be stale until the next
 * successful call.
 */

/** Mirrors the Sanctum token into an HttpOnly session cookie so proxy.ts can see auth state at the edge. */
export async function setSessionCookie(token: string, isAdmin: boolean | null | undefined): Promise<void> {
  try {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, isAdmin: Boolean(isAdmin) }),
    });
  } catch {
    // Best-effort — see file header.
  }
}

/** Clears the HttpOnly session cookie (logout / session expiry). */
export async function clearSessionCookie(): Promise<void> {
  try {
    await fetch("/api/auth/session", { method: "DELETE" });
  } catch {
    // Best-effort — see file header.
  }
}
