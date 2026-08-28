"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";

export function SiteHeader({ siteName }: { siteName: string; defaultQuery?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="discovery-header">
      <div className="app-shell header-inner">
        <Link href="/" className="brand-link" aria-label={`${siteName} home`}>
          <Logo className="brand-logo" />
          <span>{siteName}</span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <a href="https://yourhour.lol" target="_blank" rel="noopener noreferrer">Bid live on YourHour ↗</a>
          <Link href="/leaderboards">Leaderboards</Link>
          <Link href="/about">About</Link>
          <Link href="/submit" className="primary-nav-action">Submit product</Link>
        </nav>
        <button className="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span /><span /><span />
        </button>
      </div>
      {open ? (
        <div className="mobile-navigation">
          <a href="https://yourhour.lol" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Bid live on YourHour ↗</a>
          <Link href="/leaderboards" onClick={() => setOpen(false)}>Leaderboards</Link>
          <Link href="/about" onClick={() => setOpen(false)}>About</Link>
          <Link href="/submit" className="primary-nav-action" onClick={() => setOpen(false)}>Submit product</Link>
        </div>
      ) : null}
    </header>
  );
}
