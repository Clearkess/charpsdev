import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeState = {
  /** User's stored preference — may be "system" to follow the OS setting. */
  theme: ThemePreference;
  /** The actually-applied light/dark value (resolves "system" via matchMedia). */
  resolvedTheme: ResolvedTheme;
  hasHydrated: boolean;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
  setResolvedTheme: (resolved: ResolvedTheme) => void;
  markHydrated: () => void;
};

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Mirrors `--color-background` for `.light`/`.dark` in app/globals.css.
 * Keeping the Android/Chrome status bar (`<meta name="theme-color">`) in
 * sync with the ACTUAL resolved theme, not just the OS `prefers-color-scheme`
 * media query, is what fixes the "white status bar on a dark-themed app"
 * mismatch — see the comment in app/layout.tsx for the full rationale.
 */
const THEME_COLORS: Record<ResolvedTheme, string> = {
  light: "#f8fafc",
  dark: "#0b1120",
};

function applyThemeClass(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  const meta = document.getElementById("theme-color-meta");
  if (meta) meta.setAttribute("content", THEME_COLORS[resolved]);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      resolvedTheme: "light",
      hasHydrated: false,
      setTheme: (theme) => {
        const resolved = theme === "system" ? getSystemTheme() : theme;
        applyThemeClass(resolved);
        set({ theme, resolvedTheme: resolved });
      },
      toggleTheme: () => {
        const next: ResolvedTheme = get().resolvedTheme === "dark" ? "light" : "dark";
        applyThemeClass(next);
        set({ theme: next, resolvedTheme: next });
      },
      setResolvedTheme: (resolved) => {
        applyThemeClass(resolved);
        set({ resolvedTheme: resolved });
      },
      markHydrated: () => set({ hasHydrated: true }),
    }),
    {
      name: "charpsdev-theme",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state, error) => {
        if (!error) {
          const preference = state?.theme ?? "system";
          const resolved = preference === "system" ? getSystemTheme() : preference;
          applyThemeClass(resolved);
          state?.setResolvedTheme(resolved);
        }
        state?.markHydrated();
      },
    },
  ),
);
