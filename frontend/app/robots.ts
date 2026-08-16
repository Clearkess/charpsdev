import type { MetadataRoute } from "next";

const siteUrl = "https://charpsdev.vercel.app";

/**
 * Disallows the authenticated-only app surface (dashboard/admin/wallet/
 * orders/payment/etc.) — those routes render no content for a logged-out
 * crawler anyway (client-side redirect to /login, see ProtectedRoute.tsx)
 * and indexing them would only waste crawl budget / risk exposing account
 * paths in search results.
 *
 * /services and /virtual-numbers are intentionally NOT in this list
 * (Top-3-Fixes, Fix 2): they are now dual-mode top-level routes that
 * render a real, public, SEO-indexable catalogue/teaser for anonymous
 * visitors and crawlers, with the authenticated experience layered on
 * top only when a session is present. See app/services/page.tsx and
 * app/virtual-numbers/page.tsx.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/wallet", "/orders", "/cart", "/settings", "/support", "/notifications", "/profile", "/payment", "/api"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
