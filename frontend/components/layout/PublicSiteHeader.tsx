import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import BrandMark from "@/components/common/BrandMark";

/**
 * Lightweight header for public (anonymous-visitor) pages that live outside
 * the authenticated app shell — e.g. the public /services catalogue and
 * /virtual-numbers teaser (Top-3-Fixes, Fix 2). Distinct from both
 * LandingNav (the homepage's fixed dark hero nav, tied to that page's
 * `.landing` CSS) and AppLayout's sidebar/topbar (which only renders once a
 * session exists) — this one uses the ordinary app design system so it
 * reads correctly on a plain light/dark background.
 */
export default function PublicSiteHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
        <Link href="/" aria-label="Vaultra home">
          <BrandMark className="h-7 w-auto" />
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Log in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Get Started
            <ArrowRightIcon className="size-3.5" aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
