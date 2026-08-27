"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";

export function SiteHeader({ siteName, defaultQuery = "" }: { siteName: string; defaultQuery?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="discovery-header">
      <div className="app-shell header-inner">
        <Link href="/" className="brand-link" aria-label={`${siteName} home`}>
          <Logo className="brand-logo" />
          <span>{siteName}</span>
        </Link>
        <form className="header-search" action="/" method="get" role="search">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input name="q" type="search" defaultValue={defaultQuery} placeholder="Search bidding products" aria-label="Search products" />
        </form>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/">Discover</Link>
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
          <form action="/" method="get" role="search">
            <input name="q" type="search" defaultValue={defaultQuery} placeholder="Search products" aria-label="Search products" />
          </form>
          <Link href="/" onClick={() => setOpen(false)}>Discover</Link>
          <Link href="/leaderboards" onClick={() => setOpen(false)}>Leaderboards</Link>
          <Link href="/about" onClick={() => setOpen(false)}>About</Link>
          <Link href="/submit" className="primary-nav-action" onClick={() => setOpen(false)}>Submit product</Link>
        </div>
      ) : null}
    </header>
  );
}
