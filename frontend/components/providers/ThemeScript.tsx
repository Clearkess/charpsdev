/**
 * Inline, render-blocking script that applies the persisted theme class to
 * <html> BEFORE React hydrates. Without this, the page would flash the
 * light theme for a frame before Zustand's persisted store rehydrates
 * (classic dark-mode FOUC). Reads the same localStorage key/shape that
 * `store/themeStore.ts`'s zustand `persist` middleware writes.
 *
 * Also syncs the `#theme-color-meta` tag's `content` to the resolved theme
 * (not just the OS `prefers-color-scheme`) so the Android/Chrome status bar
 * matches the app's actual rendered background from the very first paint —
 * see the comment in app/layout.tsx for why the static Next viewport API
 * can't do this on its own. The two hex values here intentionally mirror
 * `--color-background` for `.light`/`.dark` in app/globals.css.
 */
const THEME_SCRIPT = `
(function () {
  var COLORS = { light: "#f8fafc", dark: "#0b1120" };
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
    var meta = document.getElementById("theme-color-meta");
    if (meta) meta.setAttribute("content", COLORS[resolved] || COLORS.light);
  } catch (e) {}
})();
`;

export default function ThemeScript() {
  // eslint-disable-next-line react/no-danger
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
}
