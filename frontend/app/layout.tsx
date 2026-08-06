import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@/app/globals.css";
import AppProviders from "@/components/providers/AppProviders";
import ThemeScript from "@/components/providers/ThemeScript";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Recovered frontend skeleton for the CharpsDev marketplace.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

/**
 * No `themeColor` here on purpose. Next's viewport metadata only supports
 * keying theme-color by the `prefers-color-scheme` MEDIA QUERY, i.e. the OS
 * setting — but this app has its own independent dark/light toggle
 * (store/themeStore.ts) that a user can set opposite to their OS preference.
 * A static OS-keyed meta tag would then show a white Android status bar
 * while the app itself is rendering dark (the exact bug reported). Instead
 * we render a single `<meta name="theme-color" id="theme-color-meta">`
 * manually below and keep its `content` in sync with the app's *resolved*
 * theme from JS (see ThemeScript.tsx for the pre-hydration value and
 * themeStore.ts's applyThemeClass for every later transition).
 */
export const viewport: Viewport = {};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" id="theme-color-meta" content="#f8fafc" />
        <ThemeScript />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
