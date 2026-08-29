"use client";

import Image from "next/image";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { IntegrationManager, type IntegrationState } from "@/components/IntegrationManager";
import { ProductLogo } from "@/components/ProductLogo";
import { XShareLink } from "@/components/XShareLink";
import type { ManagedProduct } from "@/lib/product-data";

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json() as { error?: string; message?: string };
  if (!response.ok) throw new Error(result.error || "Could not save changes.");
  return result;
}

type Evidence = { id: string; metricType: string; url: string; note: string | null; status: string };
type Tab = "product" | "updates" | "verification";
type Media = ManagedProduct["media"][number];

export function OwnerDashboard({ product, outboundClicks, growth, evidence, integration, siteUrl, initialTab = "product" }: { product: ManagedProduct; outboundClicks: number; growth:{listingViews:number;upvotes:number;outboundClicks:number;referredVisitors:number;rank:number}; evidence: Evidence[]; integration: IntegrationState; siteUrl: string; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [currentStatus, setCurrentStatus] = useState(product.status);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [media, setMedia] = useState(product.media);
  const [updates, setUpdates] = useState(product.updates);
  const [evidenceItems, setEvidenceItems] = useState(evidence);

  function start(action: string) { setBusy(action); setNotice(""); setError(""); }
  function failed(caught: unknown, fallback: string) { setError(caught instanceof Error ? caught.message : fallback); }

  const checkStatus = useCallback(async (manual = false) => {
    setCheckingStatus(true);
    if (manual) { setNotice(""); setError(""); }
    try {
      const response = await fetch(`/api/owner/products/${encodeURIComponent(product.slug)}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; status?: ManagedProduct["status"] };
      if (!response.ok || !result.status) throw new Error(result.error || "Could not check status.");
      setCurrentStatus(result.status);
      if (manual && result.status === "pending") setNotice("Your product is still waiting for approval.");
    } catch (caught) {
      if (manual) failed(caught, "Could not check status.");
    } finally {
      setCheckingStatus(false);
    }
  }, [product.slug]);

  useEffect(() => {
    if (currentStatus !== "pending") return;
    const timer = window.setInterval(() => { void checkStatus(false); }, 30_000);
    return () => window.clearInterval(timer);
  }, [checkStatus, currentStatus]);

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); start("product");
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget).entries());
      await jsonRequest(`/api/owner/products/${encodeURIComponent(product.slug)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setNotice("Product information saved.");
    } catch (caught) { failed(caught, "Could not save product information."); } finally { setBusy(""); }
  }

  async function publishUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); start("update");
    try {
      const form = event.currentTarget;
      const response = await fetch(`/api/owner/products/${encodeURIComponent(product.slug)}/updates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      const result = await response.json() as { error?: string; update?: ManagedProduct["updates"][number] };
      if (!response.ok || !result.update) throw new Error(result.error || "Could not publish the update.");
      setUpdates((current) => [result.update!, ...current]); form.reset(); setNotice("Founder update published.");
    } catch (caught) { failed(caught, "Could not publish the update."); } finally { setBusy(""); }
  }

  async function uploadMedia(event: FormEvent<HTMLFormElement>, kind: "logo" | "screenshot") {
    event.preventDefault(); start(`media-${kind}`);
    try {
      const form = event.currentTarget; const data = new FormData(form); data.set("kind", kind);
      const response = await fetch(`/api/owner/products/${encodeURIComponent(product.slug)}/media`, { method: "POST", body: data });
      const result = await response.json() as { error?: string; media?: Media };
      if (!response.ok || !result.media) throw new Error(result.error || "Upload failed.");
      setMedia((current) => kind === "logo" ? [result.media!, ...current.filter((item) => item.kind !== "logo")] : [...current, result.media!]);
      form.reset(); setNotice(kind === "logo" ? "Logo replaced." : "Screenshot added.");
    } catch (caught) { failed(caught, "Upload failed."); } finally { setBusy(""); }
  }

  async function deleteMedia(item: Media) {
    if (!window.confirm(`Remove this ${item.kind} from the product?`)) return;
    start(`delete-${item.id}`);
    try {
      await jsonRequest(`/api/owner/products/${encodeURIComponent(product.slug)}/media`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaId: item.id }) });
      setMedia((current) => current.filter((mediaItem) => mediaItem.id !== item.id)); setNotice("Image removed.");
    } catch (caught) { failed(caught, "Could not remove the image."); } finally { setBusy(""); }
  }

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); start("evidence");
    try {
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form).entries());
      const response = await fetch(`/api/owner/products/${encodeURIComponent(product.slug)}/evidence`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json() as { error?: string; id?: string; status?: string };
      if (!response.ok || !result.id) throw new Error(result.error || "Could not submit evidence.");
      setEvidenceItems((current) => [{ id: result.id!, metricType: String(values.metricType), url: String(values.evidenceUrl), note: String(values.note || "") || null, status: "pending" }, ...current]);
      form.reset(); setNotice("Public evidence submitted for administrator review.");
    } catch (caught) { failed(caught, "Could not submit evidence."); } finally { setBusy(""); }
  }

  const logo = media.find((item) => item.kind === "logo");
  const screenshots = media.filter((item) => item.kind === "screenshot").sort((a, b) => a.position - b.position);
  const verified = Boolean(integration?.productVerifiedAt);
  const tabs: Array<{ id: Tab; label: string }> = [{ id: "product", label: "Product" }, { id: "updates", label: "Updates" }, { id: "verification", label: "Verification & data" }];

  return <>
    <header className="manager-heading owner-summary"><div><p className="eyebrow">Owner management</p><h1>{product.name}</h1><p><span className={`status-pill status-${currentStatus}`}>{currentStatus === "pending" ? "Pending review" : currentStatus === "published" ? "Published" : currentStatus}</span><span aria-hidden="true"> · </span><strong className={verified ? "verified-text" : "muted-text"}>{verified ? "Verified product" : "Unverified product"}</strong><span aria-hidden="true"> · </span>{outboundClicks.toLocaleString()} unique outbound clicks</p></div>{currentStatus === "published" ? <a className="button button-secondary" href={`/product/${product.slug}`}>View public page</a> : null}</header>
    {currentStatus === "pending" ? <section className="owner-status-banner is-pending"><div><strong>Pending review</strong><p>Your product is waiting for approval. We’ll email you when it goes live.</p></div><button className="button button-secondary" type="button" disabled={checkingStatus} onClick={() => void checkStatus(true)}>{checkingStatus ? "Checking…" : "Check status"}</button></section> : null}
    {currentStatus === "published" ? <section className="owner-status-banner is-live"><div><strong>Your product is live on BidIndex.</strong><p>Your listing is publicly visible. Share it with your audience to receive early visitors and support.</p></div><div className="owner-live-actions"><XShareLink siteUrl={siteUrl} slug={product.slug} productName={product.name} description={product.tagline} source="owner" className="button button-primary" /><a className="button button-secondary" href={`/product/${product.slug}`}>View live listing</a><a className="text-button owner-manage-link" href="#manage-product">Manage product</a></div></section> : null}
    {currentStatus === "published" ? <section className="owner-growth-summary manager-card"><h2>Your growth summary</h2><div>{[["Your listing views",growth.listingViews],["Your upvotes",growth.upvotes],["Your outbound clicks",growth.outboundClicks],["Visitors you referred to BidIndex",growth.referredVisitors],["Current Most Upvoted rank",growth.rank?`#${growth.rank}`:"—"]].map(([label,value])=><span key={String(label)}><strong>{typeof value==="number"?value.toLocaleString():value}</strong><small>{label}</small></span>)}</div><p>Only genuine eligible upvotes affect organic rank. Referral traffic, verification, badges, payments, and promotions do not.</p></section> : null}
    {notice ? <p className="manager-notice is-success" role="status">{notice}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}
    <div id="manage-product" className="owner-tabs" role="tablist" aria-label="Product management sections">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>{item.label}</button>)}</div>

    {tab === "product" ? <div role="tabpanel" className="owner-tab-panel">
      <section className="manager-card"><h2>Product information</h2><form className="submission-form compact-form" onSubmit={saveProduct}>
        <label>Product name<input name="name" required maxLength={80} defaultValue={product.name} placeholder="e.g. TopBid" /></label>
        <label>One-line description <small>160 characters maximum</small><input name="tagline" required maxLength={160} defaultValue={product.tagline} placeholder="e.g. Pay $1 more to take the top spot. Every buyer remains on the leaderboard." /></label>
        <div className="form-grid"><label>Founder name <small>Optional</small><input name="founderName" maxLength={120} defaultValue={product.founderName ?? ""} placeholder="e.g. Alex Smith" /></label><label>Founder X/social handle <small>Optional</small><input name="founderSocialHandle" maxLength={120} defaultValue={product.founderSocialHandle ?? ""} placeholder="e.g. @alexsmith" /></label></div>
        <label className="consent-row optional-marketing"><input name="marketingOptIn" type="checkbox" defaultChecked={product.marketingOptedIn} disabled={product.marketingSuppressed} /> <span>Send me BidIndex growth, leaderboard and milestone updates.{product.marketingSuppressed ? " This address is permanently unsubscribed or suppressed." : ""}</span></label>
        <label>Product website<input value={product.websiteUrl} readOnly aria-readonly="true" /></label><p className="form-hint">URL changes require administrator review because changing the domain invalidates ownership verification. Contact BidIndex to request a change.</p>
        <button className="button button-primary" disabled={busy === "product"}>{busy === "product" ? "Saving…" : "Save product"}</button>
      </form></section>
      <section className="manager-card"><h2>Logo and screenshots</h2><div className="owner-media-logo"><ProductLogo productName={product.name} productUrl={product.websiteUrl} imageUrl={logo?.url ?? product.logoUrl} className="product-detail-logo" /><form className="compact-upload" onSubmit={(event) => uploadMedia(event, "logo")}><label>Replace logo<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><small>PNG, JPEG or WebP. Maximum 2 MB.</small><button className="button button-secondary" disabled={busy === "media-logo"}>{busy === "media-logo" ? "Uploading…" : "Replace logo"}</button></form></div>
        <div className="screenshot-manager-heading"><div><strong>Screenshots</strong><small>{screenshots.length} of 4</small></div>{screenshots.length < 4 ? <form className="compact-upload screenshot-upload" onSubmit={(event) => uploadMedia(event, "screenshot")}><label>Add screenshots<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button className="button button-secondary" disabled={busy === "media-screenshot"}>{busy === "media-screenshot" ? "Uploading…" : "Add screenshot"}</button></form> : null}</div>
        {screenshots.length ? <div className="owner-media-grid">{screenshots.map((item) => <figure key={item.id}><Image src={item.url} alt={item.altText || `${product.name} screenshot`} width={480} height={300} unoptimized /><button type="button" disabled={busy === `delete-${item.id}`} onClick={() => deleteMedia(item)}>Remove</button></figure>)}</div> : <div className="quiet-empty compact-empty">No screenshots added yet.</div>}
      </section>
    </div> : null}

    {tab === "updates" ? <div role="tabpanel" className="owner-tab-panel"><section className="manager-card"><h2>Publish an update</h2><form className="submission-form compact-form" onSubmit={publishUpdate}><label>Type<select name="type"><option value="feature">Feature</option><option value="launch">Launch</option><option value="milestone">Milestone</option><option value="announcement">Announcement</option></select></label><label>Title<input name="title" required maxLength={140} placeholder="e.g. Added a weekly leaderboard" /></label><label>Short body<textarea name="body" required maxLength={1500} rows={5} placeholder="Explain what changed and why it matters." /></label><label>Optional link<input name="linkUrl" type="url" maxLength={2048} placeholder="https://yourproduct.com/changelog" /></label><button className="button button-primary" disabled={busy === "update"}>{busy === "update" ? "Publishing…" : "Publish update"}</button></form></section><section className="manager-card"><h2>Published updates</h2>{updates.length ? <div className="owner-update-list">{updates.map((update) => <article key={update.id}><div><strong>{update.title}</strong><span>{update.type} · {new Date(update.publishedAt).toLocaleDateString()}</span></div><p>{update.body}</p>{update.linkUrl ? <a href={update.linkUrl} target="_blank" rel="nofollow noopener noreferrer">Open link ↗</a> : null}</article>)}</div> : <div className="quiet-empty compact-empty">No updates published yet.</div>}</section></div> : null}

    {tab === "verification" ? <div role="tabpanel" className="owner-tab-panel"><IntegrationManager slug={product.slug} initial={integration} siteUrl={siteUrl} websiteUrl={product.websiteUrl} /><details className="manager-card evidence-disclosure"><summary>Other ways to show a metric</summary><p>If you already publish revenue or traffic publicly, submit the public page for review. This is separate from live tracking.</p>{currentStatus === "published" ? <form className="submission-form compact-form" onSubmit={submitEvidence}><label>Metric type<select name="metricType"><option value="revenue">Revenue</option><option value="visitors">Visitors</option><option value="outbound_clicks">Clicks</option><option value="bids">Bids</option><option value="other">Other</option></select></label><label>Public evidence URL<input type="url" name="evidenceUrl" required maxLength={2048} placeholder="https://example.com/open" /></label><label>Optional note<textarea name="note" maxLength={500} rows={3} placeholder="e.g. Public dashboard showing lifetime revenue" /></label><button className="button button-secondary" disabled={busy === "evidence"}>{busy === "evidence" ? "Submitting…" : "Submit for review"}</button></form> : <p>Available after approval.</p>}{evidenceItems.length ? <ul className="evidence-list">{evidenceItems.map((item) => <li key={item.id}><a href={item.url} target="_blank" rel="nofollow noopener noreferrer">{item.metricType.replaceAll("_", " ")}</a><span>{item.status.replaceAll("_", " ")}</span></li>)}</ul> : null}</details></div> : null}
  </>;
}
