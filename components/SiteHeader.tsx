"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { authClient } from "@/lib/auth-client";

export function SiteHeader({ siteName, user }: { siteName: string; user: { name: string; role: "member" | "admin" } | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <header className="discovery-header">
      <div className="app-shell header-inner">
        <Link href="/" className="brand-link" aria-label={`${siteName} home`}>
          <Logo className="brand-logo" />
          <span>{siteName}</span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/?view=discover#products">Discover</Link>
          <Link href="/?view=updates#products">Updates</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/submit" className="primary-nav-action">Submit startup</Link>
          {user ? <details className="account-menu"><summary>{user.name || "Account"}</summary><div><Link href="/my-products">My products</Link><Link href="/following">Following</Link><Link href="/settings">Settings</Link>{user.role === "admin" ? <Link href="/admin">Admin</Link> : null}<button type="button" onClick={() => void authClient.signOut({ fetchOptions: { onSuccess: () => router.replace("/") } })}>Sign out</button></div></details> : <Link href="/sign-in">Sign in</Link>}
        </nav>
        <button className="nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span /><span /><span />
        </button>
      </div>
      {open ? (
        <div className="mobile-navigation">
          <Link href="/?view=discover#products" onClick={() => setOpen(false)}>Discover</Link>
          <Link href="/?view=updates#products" onClick={() => setOpen(false)}>Updates</Link>
          <Link href="/pricing" onClick={() => setOpen(false)}>Pricing</Link>
          <Link href="/submit" className="primary-nav-action" onClick={() => setOpen(false)}>Submit startup</Link>
          {user ? <><Link href="/my-products" onClick={() => setOpen(false)}>My products</Link><Link href="/following" onClick={() => setOpen(false)}>Following</Link><Link href="/settings" onClick={() => setOpen(false)}>Settings</Link>{user.role === "admin" ? <Link href="/admin" onClick={() => setOpen(false)}>Admin</Link> : null}<button type="button" className="mobile-signout" onClick={() => void authClient.signOut({ fetchOptions: { onSuccess: () => router.replace("/") } })}>Sign out</button></> : <Link href="/sign-in" onClick={() => setOpen(false)}>Sign in</Link>}
        </div>
      ) : null}
    </header>
  );
}
