import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.charpsdev.app",
  appName: "CharpsDev",
  webDir: "www",

  // --- Option A: Remote URL mode -------------------------------------------
  // The native shell does NOT bundle any HTML/JS of its own. Instead its
  // WebView loads the live, already-deployed Next.js site directly from
  // Vercel. This means:
  //   - Next.js Middleware (proxy.ts route protection), Server Components,
  //     and cookie/bearer auth all keep working exactly as on the web —
  //     nothing in frontend/ needs to change.
  //   - Every `vercel deploy --prod` update is instantly live inside the
  //     app too; there is no separate "app content" to keep in sync.
  //   - `webDir: "www"` above is required by the Capacitor CLI schema but is
  //     never actually served — `server.url` below takes precedence.
  server: {
    url: "https://charpsdev.vercel.app",
    cleartext: false,
  },

  android: {
    // Keep the WebView's own back-button behavior mapped to browser history,
    // matching normal Next.js client-side navigation.
    allowMixedContent: false,
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#f8fafc",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      // Default (light theme) status bar color; the app's own JS keeps this
      // in sync at runtime with the in-app theme toggle — see
      // frontend/store/themeStore.ts's applyThemeClass() and
      // frontend/components/providers/ThemeScript.tsx, which this shell
      // reuses unmodified since it just loads the live site.
      style: "LIGHT",
      backgroundColor: "#f8fafc",
    },
  },
};

export default config;
