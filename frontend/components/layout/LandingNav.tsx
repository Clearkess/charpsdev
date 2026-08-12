"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "#services", label: "Services" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#features", label: "Features" },
  { href: "#why-us", label: "Why CharpsDev" },
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <nav className="landing-nav">
      <Link href="/" className="brand" onClick={close}>
        <Image src="/logo.png" alt="CharpsDev logo" className="brand-logo" width={140} height={29} priority />
      </Link>

      <div className="nav-links">
        {NAV_LINKS.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </div>

      <div className="nav-actions">
        <Link className="nav-login" href="/login">
          Log in
        </Link>
        <Link className="nav-cta" href="/register">
          Get Started <ArrowRight size={16} />
        </Link>
      </div>

      <button
        type="button"
        className="mobile-menu-toggle"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>

      {open && (
        <div id="mobile-menu-panel" className="mobile-menu-panel">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} onClick={close}>
              {link.label}
            </a>
          ))}
          <div className="mobile-menu-actions">
            <Link className="nav-login" href="/login" onClick={close}>
              Log in
            </Link>
            <Link className="nav-cta" href="/register" onClick={close}>
              Get Started <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
