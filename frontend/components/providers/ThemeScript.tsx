/**
 * Inline, render-blocking script that applies the persisted theme class to
 * <html> BEFORE React hydrates. Without this, the page would flash the
 * light theme for a frame before Zustand's persisted store rehydrates
 * (classic dark-mode FOUC). Reads the same localStorage key/shape that
 * `store/themeStore.ts`'s zustand `persist` middleware writes.
 */
const THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("charpsdev-theme");
    var theme = "system";
    if (stored) {
      var parsed = JSON.parse(stored);
      theme = (parsed && parsed.state && parsed.state.theme) || "system";
    }
    var resolved = theme;
    if (theme === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    if (resolved === "dark") {
      document.documentElement.classList.add("dark");
    }
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`;

export default function ThemeScript() {
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
