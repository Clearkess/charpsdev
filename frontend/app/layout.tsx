import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@/app/globals.css";
import AppProviders from "@/components/providers/AppProviders";
import ThemeScript from "@/components/providers/ThemeScript";
import { APP_NAME } from "@/lib/constants";

const siteUrl = "https://charpsdev.vercel.app";
const title = `${APP_NAME} — Unique Social Media Accounts, Virtual Numbers & eSIMs`;
const description =
  "Vaultra is a marketplace for unique social media accounts, virtual numbers, eSIMs, data plans, airtime top-ups and gift cards — all cheap and pocket friendly. Fund your wallet, order in seconds, and track every transaction from one dashboard.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: title,
    template: `%s | ${APP_NAME}`,
  },

  description,

  keywords: [
    "Vaultra",
    "buy social media accounts",
    "virtual numbers",
    "eSIM",
    "buy data online",
    "airtime top-up",
    "gift cards",
    "digital services marketplace",
    "wallet payments",
  ],

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: APP_NAME,
    title,
    description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — social media accounts, virtual numbers & digital products marketplace`,
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/opengraph-image"],
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

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
