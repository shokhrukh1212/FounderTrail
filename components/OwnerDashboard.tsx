"use client";

import { useState, type FormEvent } from "react";
import type { ManagedProduct } from "@/lib/product-data";

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json() as { error?: string; message?: string };
  if (!response.ok) throw new Error(result.error || "Could not save changes.");
  return result;
}

export function OwnerDashboard({ product, outboundClicks }: { product: ManagedProduct; outboundClicks: number }) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget).entries());
      await jsonRequest(`/api/owner/products/${encodeURIComponent(product.slug)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setNotice("Product details saved.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save."); } finally { setBusy(false); }
  }
  async function publishUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    try {
      const form = event.currentTarget;
      await jsonRequest(`/api/owner/products/${encodeURIComponent(product.slug)}/updates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      form.reset(); setNotice("Founder update published.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not publish."); } finally { setBusy(false); }
  }
  async function uploadMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    try {
      const response = await fetch(`/api/owner/products/${encodeURIComponent(product.slug)}/media`, { method: "POST", body: new FormData(event.currentTarget) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Upload failed.");
      setNotice("Media saved. Refresh to see the updated gallery."); event.currentTarget.reset();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Upload failed."); } finally { setBusy(false); }
  }
  async function deleteMedia(mediaId: string) {
    if (!confirm("Remove this image from the product?")) return;
    setBusy(true); setNotice(""); setError("");
    try {
      await jsonRequest(`/api/owner/products/${encodeURIComponent(product.slug)}/media`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaId }) });
      setNotice("Image removed. Refresh to update the gallery.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove image."); } finally { setBusy(false); }
  }
  return <>
    <header className="manager-heading"><div><p className="eyebrow">Owner management</p><h1>{product.name}</h1><p>Status: <strong>{product.status}</strong> · {outboundClicks.toLocaleString()} unique outbound clicks</p></div><a className="button button-secondary" href={`/product/${product.slug}`}>Public page</a></header>
    {notice ? <p className="manager-notice" role="status">{notice}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="manager-grid"><section className="manager-card"><h2>Edit product</h2><form className="submission-form compact-form" onSubmit={saveProduct}>
      <label>Product name<input name="name" required maxLength={80} defaultValue={product.name} /></label><label>Tagline<input name="tagline" required maxLength={180} defaultValue={product.tagline} /></label><label>Description<textarea name="description" required maxLength={5000} rows={7} defaultValue={product.description} /></label><label>How bidding works<textarea name="biddingMechanism" required maxLength={2000} rows={5} defaultValue={product.biddingMechanism} /></label><label>Founder name<input name="founderName" required maxLength={120} defaultValue={product.founderName} /></label><label>Social handle<input name="founderSocialHandle" maxLength={120} defaultValue={product.founderSocialHandle ?? ""} /></label><button className="button button-primary" disabled={busy}>Save details</button>
    </form></section>
    <div><section className="manager-card"><h2>Publish an update</h2><form className="submission-form compact-form" onSubmit={publishUpdate}><label>Type<select name="type"><option value="feature">Feature</option><option value="milestone">Milestone</option><option value="launch">Launch</option><option value="announcement">Announcement</option></select></label><label>Title<input name="title" required maxLength={140} /></label><label>Short body<textarea name="body" required maxLength={1500} rows={5} /></label><label>Optional link<input name="linkUrl" type="url" maxLength={2048} /></label><button className="button button-primary" disabled={busy}>Publish update</button></form></section>
    <section className="manager-card"><h2>Logo and screenshots</h2><form className="submission-form compact-form" onSubmit={uploadMedia}><label>Media type<select name="kind"><option value="logo">Replace logo</option><option value="screenshot">Add screenshot</option></select></label><label>Image<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button className="button button-secondary" disabled={busy}>Upload image</button></form>{product.media.length?<ul className="media-manager-list">{product.media.map(item=><li key={item.id}><span>{item.kind} {item.position+1}</span><button type="button" disabled={busy} onClick={()=>deleteMedia(item.id)}>Remove</button></li>)}</ul>:null}</section>
    <section className="manager-card" id="integration"><h2>Partner integration</h2><p>After the integration is created, this area provides the badge snippet, public identifier, domain status, last event time, and secret rotation. No revenue secret is ever placed in browser code.</p><a className="text-link" href={`/manage/${product.slug}/integration`}>Open integration setup →</a></section></div></div>
  </>;
}
