"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Challenge = { claimId: string; fileUrl: string; fileContents: string; expiresAt: string };

export function ProductClaim({ slug, signedIn, state }: { slug: string; signedIn: boolean; state: "claimed" | "pending" | "disputed" | "unclaimed" }) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function start() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/products/${encodeURIComponent(slug)}/claims`, { method: "POST" });
    if (response.status === 401) { router.push(`/sign-in?returnTo=${encodeURIComponent(location.pathname + "#claim")}`); return; }
    const result = await response.json() as Challenge & { error?: string };
    if (response.ok) setChallenge(result); else setMessage(result.error ?? "Could not start the claim.");
    setBusy(false);
  }
  async function verify() {
    if (!challenge) return;
    setBusy(true); setMessage("Checking the domain…");
    const response = await fetch(`/api/claims/${challenge.claimId}/verify`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: challenge.fileContents.replace(/^foundertrail-claim=/, "") }),
    });
    const result = await response.json() as { error?: string;disputed?:boolean };
    if (response.ok){setMessage(result.disputed?"Domain control was verified. The competing claim is waiting for administrator review.":"");router.refresh()} else setMessage(result.error ?? "We could not verify the file yet.");
    setBusy(false);
  }
  if(state==="disputed")return <section id="claim" className="detail-section claim-section"><p className="eyebrow">Ownership dispute</p><h2>Manual review pending</h2><p className="long-copy">Domain control was verified, but this listing already has an owner. FounderTrail will review the competing evidence; the current owner remains attached unless an administrator completes a documented resolution.</p></section>;
  return <section id="claim" className="detail-section claim-section"><p className="eyebrow">Ownership</p><h2>{state==="claimed"?"Request an ownership review":"Claim this product"}</h2><p className="long-copy">{state==="claimed"?"This listing already has a verified owner. If that ownership is incorrect, verify current control of the product domain to open a competing claim for manual review. Domain proof does not replace the current owner automatically.":"Verify control of the product’s domain to manage its profile, publish updates, and see private reports. This does not change its existing history."}</p>
    {!signedIn ? <Link className="button button-secondary" href={`/sign-in?returnTo=${encodeURIComponent(`/product/${slug}#claim`)}`}>Sign in to claim</Link> : !challenge ? <button className="button button-secondary" disabled={busy} onClick={() => void start()}>{state === "pending" ? "Continue or refresh domain proof" : state==="claimed"?"Verify domain and open dispute":"Start domain verification"}</button> : <div className="claim-challenge"><p>Publish this one-line text file on your product domain:</p><dl><div><dt>File</dt><dd><code>{challenge.fileUrl}</code></dd></div><div><dt>Contents</dt><dd><code>{challenge.fileContents}</code></dd></div><div><dt>Expires</dt><dd>{new Date(challenge.expiresAt).toLocaleString()}</dd></div></dl><button className="button button-primary" disabled={busy} onClick={() => void verify()}>Check verification file</button></div>}
    {message ? <p className="form-message" role="status">{message}</p> : null}
  </section>;
}
