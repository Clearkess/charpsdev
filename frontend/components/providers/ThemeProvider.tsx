"use client";

import { useEffect, type ReactNode } from "react";
import { useThemeStore } from "@/store/themeStore";

/**
 * Keeps the resolved theme in sync with OS-level changes while the user's
 * preference is "system", and re-applies the `.dark` class after hydration
 * (the persisted store may resolve after ThemeScript's inline pre-hydration
 * pass, e.g. on first-ever visit with no localStorage entry yet).
 */
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((state) => state.theme);
  const setResolvedTheme = useThemeStore((state) => state.setResolvedTheme);

  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolvedTheme(media.matches ? "dark" : "light");
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, setResolvedTheme]);

  return <>{children}</>;
}
