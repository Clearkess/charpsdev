import type { MetadataRoute } from "next";

const siteUrl = "https://charpsdev.vercel.app";

/**
 * Disallows the authenticated app surface (dashboard/admin/wallet/orders/
 * payment) — those routes render no content for a logged-out crawler
 * anyway (client-side redirect to /login, see ProtectedRoute.tsx) and
 * indexing them would only waste crawl budget / risk exposing account
 * paths in search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/wallet", "/orders", "/cart", "/services", "/virtual-numbers", "/settings", "/support", "/notifications", "/profile", "/payment", "/api"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
