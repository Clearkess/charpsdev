/**
 * Vaultra logo (icon + wordmark), theme-aware.
 *
 * `logo.png` has white wordmark text designed to sit on the landing page's
 * permanently-dark background. The rest of the app defaults to a *light*
 * background (see globals.css `--color-*` system + class-based `.dark`
 * toggle), so a second variant (`logo-light.png`) with dark-navy wordmark
 * text is swapped in via Tailwind's `dark:` variant — matching the pattern
 * already used elsewhere in this codebase (see e.g. `dark:bg-input/30` on
 * form inputs) instead of introducing a new theming mechanism.
 */
export default function BrandMark({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <>
      <img src="/logo-light.png" alt="Vaultra" className={`${className} dark:hidden`} />
      <img src="/logo.png" alt="Vaultra" className={`${className} hidden dark:block`} />
    </>
  );
}
