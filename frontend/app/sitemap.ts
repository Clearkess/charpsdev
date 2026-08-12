import type { MetadataRoute } from "next";

const baseUrl = "https://charpsdev.vercel.app";

/**
 * Only lists routes that render real, indexable content for a logged-out
 * visitor. Dashboard/admin/wallet/etc. are client-auth-gated (see
 * ProtectedRoute.tsx) and excluded via app/robots.ts, so they're
 * intentionally left out here too.
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
  ];
}
