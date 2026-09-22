"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function OwnerAccess({ slug }: { slug: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("Sign in and verify ownership to manage this product.");
  const [checking, setChecking] = useState(true);
  useEffect(() => {
    const stored = window.sessionStorage.getItem("bidindex-owner-fragment") ?? "";
    window.sessionStorage.removeItem("bidindex-owner-fragment");
    const fragment = window.location.hash || stored;
    const parameters = new URLSearchParams(fragment.slice(1));
    const token = parameters.get("token") ?? parameters.get("approval");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    if (!token) { window.setTimeout(() => setChecking(false), 0); return; }
    fetch(`/api/products/${encodeURIComponent(slug)}/claims/legacy`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) })
      .then(async (response) => {
        if (response.status === 401) { window.sessionStorage.setItem("bidindex-owner-fragment", fragment); router.push(`/sign-in?returnTo=${encodeURIComponent(`/manage/${slug}`)}`); return; }
        if (!response.ok) throw new Error();
        router.refresh();
      })
      .catch(() => { setMessage("That legacy management proof is invalid, rotated, or already attached to another account. Use domain verification instead."); setChecking(false); });
  }, [router, slug]);
  return <section className="owner-access"><h1>Product management requires an account</h1><p>{checking ? "Checking secure ownership proof…" : message}</p>{!checking ? <div className="button-row"><Link className="button button-primary" href={`/sign-in?returnTo=${encodeURIComponent(`/manage/${slug}`)}`}>Sign in</Link><Link className="button button-secondary" href={`/claim/${slug}`}>Verify the domain</Link></div> : null}</section>;
}
