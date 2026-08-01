/**
 * Real CharpsDev logo (icon + wordmark), theme-aware.
 *
 * The source asset has a white "Dev" and a white icon accent, designed to
 * sit on the landing page's permanently-dark background. The rest of the
 * app defaults to a *light* background (see globals.css `--color-*`
 * system + class-based `.dark` toggle), so a second variant with the white
 * parts recolored to dark navy is swapped in via Tailwind's `dark:`
 * variant — matching the pattern already used elsewhere in this codebase
 * (see e.g. `dark:bg-input/30` on form inputs) instead of introducing a
 * new theming mechanism.
 */
export default function BrandMark({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <>
      <img src="/logo-light.png" alt="CharpsDev" className={`${className} dark:hidden`} />
      <img src="/logo.png" alt="CharpsDev" className={`${className} hidden dark:block`} />
    </>
  );
}
