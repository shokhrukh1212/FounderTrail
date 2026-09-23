"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PlanFeatureList } from "./PlanFeatureList";
import { PRO_INTRO_SLOTS, PRO_PLAN_FEATURES, introPriceLine } from "@/lib/plan-features";

type Props = { slug: string; name: string; initialPriceMinor: 500 | 900; introAvailable: number; orderId: string | null; configured: boolean; submission?: boolean };

export function ProCheckout({ slug, name, initialPriceMinor, introAvailable, orderId, configured, submission = false }: Props) {
  const opening = useRef(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [price, setPrice] = useState(initialPriceMinor);
  const [state, setState] = useState<"ready" | "opening" | "confirming" | "active" | "failed" | "refunded" | "suspended">(orderId ? "confirming" : "ready");
  const [message, setMessage] = useState("");

  const poll = useCallback(async () => {
    if (!orderId) return;
    const response = await fetch(`/api/owner/products/${encodeURIComponent(slug)}/pro/orders/${encodeURIComponent(orderId)}`, { cache: "no-store" });
    const result = await response.json() as { error?: string; orderStatus?: string; entitlementStatus?: string | null; checkoutUrl?: string | null };
    if (!response.ok) { setMessage(result.error || "Could not check payment. We’ll retry shortly."); return; }
    setResumeUrl(result.checkoutUrl ?? null);
    if (result.orderStatus === "refund_pending") { setMessage("Your refund is pending provider confirmation."); setResumeUrl(null); return; }
    if (result.entitlementStatus === "active") { setState("active"); return; }
    if (result.entitlementStatus === "suspended") { setState("suspended"); return; }
    if (result.orderStatus === "refunded") { setState("refunded"); return; }
    if (result.orderStatus === "held") { setState("failed"); setMessage("Checkout did not finish opening. Your submission is saved; retry when ready."); return; }
    if (["failed","cancelled","payment_conflict"].includes(result.orderStatus || "")) { setState("failed"); setMessage(result.orderStatus === "payment_conflict" ? "The payment arrived after introductory inventory was reallocated. A full refund has been queued." : "The payment was not completed. You can retry without losing your startup data."); return; }
    setState("confirming");
  }, [orderId, slug]);

  useEffect(() => {
    if (!orderId || state !== "confirming") return;
    const check = () => void poll().catch(() => setMessage("Could not check payment. We’ll retry shortly."));
    const first = window.setTimeout(check, 0);
    const timer = window.setInterval(check, 2500);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [orderId, poll, state]);

  async function checkout() {
    if (opening.current) return;
    opening.current = true;
    setState("opening"); setMessage("");
    try {
    const response = await fetch(`/api/owner/products/${encodeURIComponent(slug)}/pro/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ acceptedPriceMinor: price, entryPoint: submission ? "submission" : "dashboard" }) });
    const result = await response.json() as { error?: string; checkoutUrl?: string; currentPriceMinor?: 500 | 900; redirectTo?: string };
    if (response.status === 409 && result.currentPriceMinor) { setPrice(result.currentPriceMinor); setMessage(result.error || "The price changed. Review it and continue when ready."); setState("ready"); return; }
    if (result.redirectTo) { window.location.assign(result.redirectTo); return; }
    if (!response.ok || !result.checkoutUrl) { setMessage(result.error || "Checkout could not be opened."); setState("failed"); return; }
    window.location.assign(result.checkoutUrl);
    } catch { setMessage("Checkout couldn’t open. Your startup is still saved."); setState("failed"); }
    finally { opening.current = false; }
  }

  if (state === "active") return <section className="pro-success" aria-live="polite"><p className="eyebrow">Payment confirmed</p><h2>{name} is now Pro</h2><p>Your launch tools are ready. Pro does not change ranking, placement, moderation, or review treatment.</p><div className="button-row"><Link className="button button-primary" href={`/manage/${slug}?tab=launch-kit`}>Create launch image</Link><Link className="button button-secondary" href={`/manage/${slug}?tab=launch-kit#social-posts`}>Write launch post</Link><Link className="button button-secondary" href={`/manage/${slug}?tab=results`}>View results</Link></div></section>;
  if (state === "confirming") return <section className="pro-confirming" aria-live="polite"><span className="loading-dot" aria-hidden="true" /><h2>Your submission is saved. We’re confirming your payment.</h2><p>Pro activates after verified payment confirmation. You can safely return later.</p>{message ? <p role="status">{message}</p> : null}<div className="button-row">{resumeUrl ? <a className="button button-primary" href={resumeUrl}>Resume existing checkout</a> : null}<Link className="button button-secondary" href={`/manage/${slug}`}>Continue to dashboard</Link></div></section>;
  if (state === "refunded" || state === "suspended") return <section className="manager-notice"><h2>{state === "refunded" ? "Pro was refunded" : "Pro access is suspended"}</h2><p>{state === "refunded" ? "The free startup page and its history are unchanged." : "A payment dispute is being reviewed. Your free startup page remains live."}</p></section>;

  return <section className="pro-checkout-card">
    <p className="eyebrow">Pro Launch · one-time upgrade for this startup</p><div className="pro-price"><strong>${price / 100}</strong><span>one-time / per startup</span></div>
    <p className="pro-intro-line">{introPriceLine(introAvailable)}</p>
    {introAvailable > 0 ? <p className="pro-availability"><strong>{introAvailable} of {PRO_INTRO_SLOTS} introductory upgrades available</strong></p> : null}
    <PlanFeatureList features={PRO_PLAN_FEATURES} tone="pro" />
    <p className="form-hint">Applicable taxes, if any, are shown by Dodo Payments before you confirm. Pro does not buy placement or affect organic ranking.</p>
    {submission ? <p>All submissions are reviewed. If your startup is rejected, we’ll refund your Pro purchase.</p> : null}
    {state === "failed" && submission ? <p>Your startup was submitted for review. Pro hasn’t been activated yet.</p> : null}
    {message ? <p className="form-error" role="alert">{message}</p> : null}
    {!configured ? <p className="manager-notice">Checkout is not available yet. Your listing and the preview remain available.</p> : <button className="button button-primary" type="button" disabled={state === "opening"} onClick={() => void checkout()}>{state === "opening" ? "Opening secure checkout…" : `Unlock Pro for $${price / 100}`}</button>}
    {submission ? <Link className="button button-secondary" href={`/manage/${slug}`}>Continue free</Link> : null}
  </section>;
}
