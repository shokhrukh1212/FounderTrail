"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "./Logo";

function SearchForm({ variant, onSubmitted }: { variant: "desktop" | "mobile"; onSubmitted?: () => void }) {
  const router = useRouter();
  const current = useSearchParams().get("q") ?? "";
  return (
    <form
      key={current}
      role="search"
      action="/"
      className={variant === "desktop" ? "header-search" : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        const value = (new FormData(event.currentTarget).get("q") ?? "").toString().trim();
        router.push(value ? `/?q=${encodeURIComponent(value)}` : "/");
        onSubmitted?.();
      }}
    >
      {variant === "desktop" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" strokeLinecap="round" /></svg>
      ) : null}
      <input type="search" name="q" defaultValue={current} placeholder="Search products" aria-label="Search products" maxLength={80} />
    </form>
  );
}

export function SiteHeader({ siteName }: { siteName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="discovery-header">
      <div className="app-shell header-inner">
        <Link href="/" className="brand-link" aria-label={`${siteName} home`}>
          <Logo className="brand-logo" />
          <span>{siteName}</span>
        </Link>
        {/* useSearchParams needs a boundary so it never opts a page out of prerendering. */}
        <Suspense fallback={<div className="header-search" aria-hidden="true" />}>
          <SearchForm variant="desktop" />
        </Suspense>
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
          <Suspense fallback={null}>
            <SearchForm variant="mobile" onSubmitted={() => setOpen(false)} />
          </Suspense>
          <a href="https://yourhour.lol" target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>Bid live on YourHour ↗</a>
          <Link href="/leaderboards" onClick={() => setOpen(false)}>Leaderboards</Link>
          <Link href="/about" onClick={() => setOpen(false)}>About</Link>
          <Link href="/submit" className="primary-nav-action" onClick={() => setOpen(false)}>Submit product</Link>
        </div>
      ) : null}
    </header>
  );
}
