import type { MetadataRoute } from "next";

const baseUrl = "https://charpsdev.vercel.app";

/**
 * Only lists routes that render real, indexable content for a logged-out
 * visitor. Dashboard/admin/wallet/etc. remain client-auth-gated (see
 * ProtectedRoute.tsx) and excluded via app/robots.ts, so they're
 * intentionally left out here too.
 *
 * /services and /virtual-numbers are included (Top-3-Fixes, Fix 2): both
 * are now dual-mode top-level routes with a real public catalogue/teaser
 * for anonymous visitors, so they belong in the sitemap like any other
 * public marketing/content page.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/virtual-numbers`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
