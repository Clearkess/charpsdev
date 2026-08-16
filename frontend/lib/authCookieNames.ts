/**
 * Shared session-cookie name constants, used by both the Edge middleware
 * (proxy.ts) and the server-side session Route Handler
 * (app/api/auth/session/route.ts) — kept in one place so the two can never
 * drift out of sync.
 *
 * In production we use the `__Host-` prefix. Browsers enforce three rules
 * for any cookie named with this prefix: it MUST be set with `Secure`, MUST
 * have `Path=/`, and MUST NOT have a `Domain` attribute — i.e. the browser
 * itself refuses to store/send the cookie otherwise. That gives us a
 * platform-level guarantee against cookie-fixation/subdomain-scoping
 * attacks, on top of the `HttpOnly`/`SameSite=Lax` flags we already set.
 *
 * Locally (http://localhost) a `Secure` cookie is not reliably persisted by
 * every browser/tool, so local dev falls back to the un-prefixed name
 * without `Secure` so the login flow keeps working outside production.
 */
const isProd = process.env.NODE_ENV === "production";

export const TOKEN_COOKIE_NAME = isProd ? "__Host-charpsdev_token" : "charpsdev_token";
export const ROLE_COOKIE_NAME = isProd ? "__Host-charpsdev_role" : "charpsdev_role";

export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days, matches the previous cookie lifetime.
