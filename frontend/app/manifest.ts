import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/constants";

/**
 * Installable-only PWA manifest (no service worker / offline caching — see
 * README "Push notifications" section for the minimal SW used only for
 * push message handling). Served automatically by Next.js at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Digital services marketplace`,
    short_name: APP_NAME,
    description: "Buy VTU, gift cards, eSIMs, and digital services on the CharpsDev marketplace.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#f6b91f",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
