"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { IntegrationManager, type IntegrationState } from "@/components/IntegrationManager";
import { ProductLogo } from "@/components/ProductLogo";
import { XShareLink } from "@/components/XShareLink";
import type { ManagedProduct } from "@/lib/product-data";
import { ProBadge } from "@/components/ProBadge";
import { CategoryPicker } from "@/components/CategoryPicker";
import { PricingFields } from "@/components/PricingFields";
import { OWNER_TABS, ownerTabHref, type OwnerTab } from "@/lib/owner-tabs";
import { suggestedShortName } from "@/lib/display-text";
import { useRouter } from "next/navigation";

/** A failed save, carrying the form field the server rejected when it names one. */
class SaveError extends Error {
  constructor(message: string, readonly field?: string) { super(message); }
}

async function jsonRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({})) as { error?: string; message?: string; field?: string; proSelected?: boolean };
  if (!response.ok) throw new SaveError(result.error || "Could not save changes.", result.field);
  return result;
}

const PRODUCT_NAME_MAX = 60;

/**
 * What the Product name field starts with. A saved short name wins. A legacy listing name
 * longer than the field ("Brand - tagline") would fail validation on every save, so the
 * field starts from the brand part instead and says so.
 */
export function initialProductName(product: { name: string; shortName: string | null; displayName: string }): { value: string; suggested: boolean } {
  if (product.shortName) return { value: product.shortName, suggested: false };
  if (product.displayName.length <= PRODUCT_NAME_MAX) return { value: product.displayName, suggested: false };
  return { value: suggestedShortName(product.name) ?? product.displayName.slice(0, PRODUCT_NAME_MAX).trim(), suggested: true };
}

type Evidence = { id: string; metricType: string; url: string; note: string | null; status: string };
type Media = ManagedProduct["media"][number];
type WorkspaceUpdate = { id:string;type:string;title:string;body:string;linkUrl:string|null;status:"draft"|"published"|"archived";publishedAt:string|null;updatedAt:string };

/**
 * One owner workspace. A single row of tabs — each a real URL — drives everything below
 * the status banner; the header and banner stay put. Launch kit and Results are rendered
 * on the server and handed in as `children`, so they sit inside the same shell.
 */
export function OwnerDashboard({ product, workspaceUpdates, outboundClicks, growth, evidence, integration, siteUrl,initialReviewReason, proStatus, tab = "overview", children }: { product: ManagedProduct; workspaceUpdates:WorkspaceUpdate[]; outboundClicks: number; growth:{listingViews:number;outboundClicks:number;followers:number;comments:number;launchVotes:number}; evidence: Evidence[]; integration: IntegrationState; siteUrl: string;initialReviewReason:string|null; proStatus:string|null; tab?: OwnerTab; children?: ReactNode }) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(product.status);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [reviewReason,setReviewReason]=useState(initialReviewReason??"");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [media, setMedia] = useState(product.media);
  const [updates, setUpdates] = useState(workspaceUpdates);
  const [evidenceItems, setEvidenceItems] = useState(evidence);

  const productName = initialProductName(product);
  const [nameSuggested, setNameSuggested] = useState(productName.suggested);
  const [productResult, setProductResult] = useState<{ ok: boolean; text: string } | null>(null);
  function start(action: string) { setBusy(action); setNotice(""); setError(""); }
  function failed(caught: unknown, fallback: string) { setError(caught instanceof Error ? caught.message : fallback); }

  const checkStatus = useCallback(async (manual = false) => {
    setCheckingStatus(true);
    if (manual) { setNotice(""); setError(""); }
    try {
      const response = await fetch(`/api/owner/products/${encodeURIComponent(product.slug)}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; status?: ManagedProduct["status"];reviewReason?:string|null };
      if (!response.ok || !result.status) throw new Error(result.error || "Could not check status.");
      setCurrentStatus(result.status);
      setReviewReason(result.reviewReason??"");
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

  // The product form is long, so its result is shown beside its Save button rather than at
  // the top of the tab, and a rejected field is focused so the problem is on screen.
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); start("product"); setProductResult(null);
    const form = event.currentTarget;
    try {
      const body = Object.fromEntries(new FormData(form).entries());
      await jsonRequest(`/api/owner/products/${encodeURIComponent(product.slug)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      setProductResult({ ok: true, text: "Product information saved." }); setNameSuggested(false);
    } catch (caught) {
      setProductResult({ ok: false, text: caught instanceof Error ? caught.message : "Could not save product information." });
      const field = caught instanceof SaveError && caught.field ? form.elements.namedItem(caught.field) : null;
      if (field instanceof HTMLElement) field.focus();
    } finally { setBusy(""); }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); start("settings");
    try {
      const marketingOptIn = new FormData(event.currentTarget).get("marketingOptIn") === "on";
      await jsonRequest(`/api/owner/products/${encodeURIComponent(product.slug)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "update_settings", marketingOptIn }) });
      setNotice("Settings saved.");
    } catch (caught) { failed(caught, "Could not save settings."); } finally { setBusy(""); }
  }

  async function submitDraft(){start("submit-draft");try{const result=await jsonRequest(`/api/owner/products/${encodeURIComponent(product.slug)}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({action:"submit_for_review"})});setCurrentStatus("pending");setReviewReason("");if(result.proSelected){router.push(`/manage/${encodeURIComponent(product.slug)}/pro`);return}setNotice("Submitted for review.")}catch(caught){failed(caught,"Verify ownership before submitting for review.")}finally{setBusy("")}}

  async function publishUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); start("update");
    try {
      const form = event.currentTarget;
      const submitter = (event.nativeEvent as SubmitEvent).submitter;
      const response = await fetch(`/api/owner/products/${encodeURIComponent(product.slug)}/updates`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form,submitter).entries())) });
      const result = await response.json() as { error?: string; update?: WorkspaceUpdate };
      if (!response.ok || !result.update) throw new Error(result.error || "Could not publish the update.");
      setUpdates((current) => [result.update!, ...current]); form.reset(); setNotice(result.update.status === "draft" ? "Draft saved." : "Founder update published.");
    } catch (caught) { failed(caught, "Could not publish the update."); } finally { setBusy(""); }
  }

  async function updateAction(item:WorkspaceUpdate,action:"publish"|"archive"|"save"){
    start(`update-${item.id}`);
    try{
      let values:Record<string,unknown>={id:item.id,action};
      if(action==="save"){
        const title=window.prompt("Update title",item.title);if(title===null){setBusy("");return}
        const body=window.prompt("Short update body",item.body);if(body===null){setBusy("");return}
        const linkUrl=window.prompt("Optional public link",item.linkUrl??"");if(linkUrl===null){setBusy("");return}
        values={...values,type:item.type,title,body,linkUrl};
      }
      await jsonRequest(`/api/owner/products/${encodeURIComponent(product.slug)}/updates`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(values)});
      if(action==="archive")setUpdates(current=>current.map(update=>update.id===item.id?{...update,status:"archived"}:update));
      else if(action==="publish")setUpdates(current=>current.map(update=>update.id===item.id?{...update,status:"published",publishedAt:update.publishedAt??new Date().toISOString()}:update));
      else location.reload();
      setNotice(action==="archive"?"Update archived.":action==="publish"?"Update published.":"Update saved.");
    }catch(caught){failed(caught,"Could not update this post.")}finally{setBusy("")}
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
  const isPro = proStatus === "active";
  const embedded = tab === "launch-kit" || tab === "results";

  // On narrow screens the tab row scrolls sideways; keep the current tab visible in it.
  const tabNav = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = tabNav.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2;
  }, [tab]);

  return <>
    <header className="manager-heading owner-summary print-hide"><div><p className="eyebrow">Owner management</p><div className="startup-name-line"><h1>{product.displayName}</h1>{isPro ? <ProBadge /> : null}</div><p><span className={`status-pill status-${currentStatus}`}>{currentStatus === "pending" ? "Pending review" : currentStatus === "published" ? "Published" : currentStatus}</span><span aria-hidden="true"> · </span><strong className={verified ? "verified-text" : "muted-text"}>{verified ? "Ownership and product control confirmed" : "Product control not verified"}</strong><span aria-hidden="true"> · </span>{outboundClicks.toLocaleString()} unique outbound clicks</p></div></header>

    <nav ref={tabNav} id="manage-product" className="owner-page-nav print-hide" aria-label="Startup management">
      {OWNER_TABS.map((item) => <Link key={item.id} href={ownerTabHref(product.slug, item.id)} scroll={false} aria-current={tab === item.id ? "page" : undefined}>{item.label}</Link>)}
    </nav>

    <div className="print-hide">
    {currentStatus === "draft" ? <section className="owner-status-banner is-pending"><div><strong>Your draft is private</strong><p>Verify control of the product domain, then send the draft to moderation.</p></div><div className="owner-live-actions"><a className="button button-secondary" href={`/claim/${product.slug}`}>Verify ownership</a><button className="button button-primary" disabled={busy==="submit-draft"} onClick={()=>void submitDraft()}>Submit for review</button></div></section>:null}
    {currentStatus === "pending" ? <section className="owner-status-banner is-review"><div><strong>Pending review</strong><p>Your product is waiting for approval. We’ll email you when it goes live.</p></div><button className="button button-secondary" type="button" disabled={checkingStatus} onClick={() => void checkStatus(true)}>{checkingStatus ? "Checking…" : "Check status"}</button></section> : null}
    {currentStatus === "rejected" ? <section className="owner-status-banner is-rejected"><div><strong>Changes requested</strong><p>{reviewReason||"Review the listing details, make the requested changes, and submit it again."}</p></div><button className="button button-primary" disabled={busy==="submit-draft"} onClick={()=>void submitDraft()}>{busy==="submit-draft"?"Submitting…":"Submit changes for review"}</button></section>:null}
    {currentStatus === "published" ? <section className="owner-status-banner is-live"><div><strong>Your product is live on FounderTrail.</strong><p>Your listing is public. Share it, answer useful questions, and publish meaningful progress.</p></div><div className="owner-live-actions is-single-row"><XShareLink siteUrl={siteUrl} slug={product.slug} productName={product.displayName} source="owner" className="button button-primary" /><a className="button button-secondary" href={`/product/${product.slug}`}>View public page</a><a className="button button-secondary" href={`/manage/${product.slug}/launch`}>Schedule launch</a>{isPro ? null : <a className="button button-secondary" href={`/manage/${product.slug}/pro`}>Upgrade to Pro</a>}</div></section> : null}
    {notice ? <p className="manager-notice is-success" role="status">{notice}</p> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>

    {embedded ? <div className="owner-tab-panel is-wide">{children}</div> : null}

    {tab === "overview" ? <div className="owner-tab-panel">
      {currentStatus === "published" ? <section className="owner-growth-summary manager-card"><h2>Your product activity</h2><div>{[["Qualified profile views",growth.listingViews],["Qualified outbound clicks",growth.outboundClicks],["Current followers",growth.followers],["Visible discussion posts",growth.comments],["Current launch votes",growth.launchVotes]].map(([label,value])=><span key={String(label)}><strong>{value.toLocaleString()}</strong><small>{label}</small></span>)}</div><p>Views and clicks are all-time qualified FounderTrail events; followers and visible posts are current totals. Launch votes are separate from legacy support totals. Pro never changes organic launch order.</p></section> : null}
      <section className="manager-card"><h2>Product information</h2><form className="submission-form compact-form" onSubmit={saveProduct}>
        <label>Product name <small>Your product&apos;s name only; put its tagline below.</small><input name="shortName" required maxLength={PRODUCT_NAME_MAX} defaultValue={productName.value} placeholder="e.g. Atlas" aria-describedby={nameSuggested ? "product-name-suggestion" : undefined} /></label>
        {nameSuggested ? <p id="product-name-suggestion" className="field-help name-suggestion">Your listing name is {product.displayName.length} characters, over the {PRODUCT_NAME_MAX}-character limit, so we suggested &ldquo;{productName.value}&rdquo;. Edit it if needed, then save.</p> : null}
        <label>One-line description <small>160 characters maximum</small><input name="tagline" required maxLength={160} defaultValue={product.tagline} placeholder="e.g. Turn support questions into clear, searchable answers." /></label>
        <div className="form-grid"><label>Founder name <small>Optional</small><input name="founderName" maxLength={120} defaultValue={product.founderName ?? ""} placeholder="e.g. Alex Smith" /></label><label>Founder X handle <small>Optional · starts with @</small><input name="founderSocialHandle" maxLength={120} defaultValue={product.founderSocialHandle ?? ""} placeholder="@yourhandle" autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label></div>
        <CategoryPicker initial={product.categorySlugs} />
        <PricingFields pricing={product.pricing} />
        <div className="form-save-row"><button className="button button-primary" disabled={busy === "product"}>{busy === "product" ? "Saving…" : "Save product"}</button>{productResult ? <p className={productResult.ok ? "form-save-status is-saved" : "form-error"} role={productResult.ok ? "status" : "alert"}>{productResult.text}</p> : null}</div>
      </form></section>
      <section className="manager-card"><h2>Logo and screenshots</h2><div className="owner-media-logo"><ProductLogo productName={product.displayName} productUrl={product.websiteUrl} imageUrl={logo?.url ?? product.logoUrl} className="product-detail-logo" /><form className="compact-upload" onSubmit={(event) => uploadMedia(event, "logo")}><label>Replace logo<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><small>PNG, JPEG or WebP. Maximum 2 MB.</small><button className="button button-secondary" disabled={busy === "media-logo"}>{busy === "media-logo" ? "Uploading…" : "Replace logo"}</button></form></div>
        <div className="screenshot-manager-heading"><div><strong>Screenshots</strong><small>{screenshots.length} of 4</small></div>{screenshots.length < 4 ? <form className="compact-upload screenshot-upload" onSubmit={(event) => uploadMedia(event, "screenshot")}><label>Add screenshots<input name="image" type="file" accept="image/png,image/jpeg,image/webp" required /></label><button className="button button-secondary" disabled={busy === "media-screenshot"}>{busy === "media-screenshot" ? "Uploading…" : "Add screenshot"}</button></form> : null}</div>
        {screenshots.length ? <div className="owner-media-grid">{screenshots.map((item) => <figure key={item.id}><Image src={item.url} alt={item.altText || `${product.displayName} screenshot`} width={480} height={300} unoptimized /><button type="button" disabled={busy === `delete-${item.id}`} onClick={() => deleteMedia(item)}>Remove</button></figure>)}</div> : <div className="quiet-empty compact-empty">No screenshots added yet.</div>}
      </section>
    </div> : null}

    {tab === "settings" ? <div className="owner-tab-panel">
      <section className="manager-card"><h2>Founder emails</h2><form className="submission-form compact-form" onSubmit={saveSettings}>
        <label className="consent-row optional-marketing"><input name="marketingOptIn" type="checkbox" defaultChecked={product.marketingOptedIn} disabled={product.marketingSuppressed} /> <span>Send me occasional FounderTrail product and founder news.{product.marketingSuppressed ? " This address is permanently unsubscribed or suppressed." : ""}</span></label>
        <p className="form-hint">Approval, ownership and payment emails are always sent; this only covers optional news.</p>
        <button className="button button-primary" disabled={busy === "settings" || product.marketingSuppressed}>{busy === "settings" ? "Saving…" : "Save settings"}</button>
      </form></section>
      <section className="manager-card"><h2>Product website</h2><div className="submission-form compact-form"><label>Website<input value={product.websiteUrl} readOnly aria-readonly="true" /></label><p className="form-hint">URL changes require administrator review because changing the domain invalidates ownership verification. Contact FounderTrail to request a change.</p></div></section>
      <section className="manager-card"><h2>Account</h2><p>Your weekly followed-products digest and account deletion live in your account settings.</p><a className="button button-secondary" href="/settings">Open account settings</a></section>
    </div> : null}

    {tab === "updates" ? <div role="tabpanel" className="owner-tab-panel"><section className="manager-card"><h2>Write an update</h2><p>Preview a saved draft here, then publish it when it is ready. Updates do not reset your launch date.</p><form className="submission-form compact-form" onSubmit={publishUpdate}><label>Type<select name="type"><option value="feature">Feature</option><option value="improvement">Improvement</option><option value="milestone">Milestone</option></select></label><label>Title<input name="title" required maxLength={140} placeholder="e.g. Added team exports" /></label><label>Short body<textarea name="body" required maxLength={1500} rows={5} placeholder="Explain what changed and why it matters." /></label><label>Optional link<input name="linkUrl" type="url" maxLength={2048} placeholder="https://yourproduct.com/changelog" /></label><div className="button-row"><button name="status" value="draft" className="button button-secondary" disabled={busy === "update"}>Save draft</button><button name="status" value="published" className="button button-primary" disabled={busy === "update"}>{busy === "update" ? "Saving…" : "Publish update"}</button></div></form></section><section className="manager-card"><h2>Updates</h2>{updates.length ? <div className="owner-update-list">{updates.map((update) => <article key={update.id} className={`update-${update.status}`}><div><strong>{update.title}</strong><span>{update.status} · {update.type} · {new Date(update.publishedAt??update.updatedAt).toLocaleDateString()}</span></div><p>{update.body}</p>{update.linkUrl ? <a href={update.linkUrl} target="_blank" rel="nofollow noopener noreferrer">Open link ↗</a> : null}<div className="comment-actions">{update.status!=="archived"?<button type="button" onClick={()=>void updateAction(update,"save")}>Edit</button>:null}{update.status==="draft"?<button type="button" onClick={()=>void updateAction(update,"publish")}>Publish</button>:null}{update.status!=="archived"?<button type="button" onClick={()=>void updateAction(update,"archive")}>Archive</button>:null}</div></article>)}</div> : <div className="quiet-empty compact-empty">No updates yet.</div>}</section></div> : null}

    {tab === "verification" ? <div role="tabpanel" className="owner-tab-panel"><IntegrationManager slug={product.slug} initial={integration} siteUrl={siteUrl} websiteUrl={product.websiteUrl} /><details className="manager-card evidence-disclosure"><summary>Other ways to show a metric</summary><p>If you already publish revenue or traffic publicly, submit the public page for review. This is separate from live tracking.</p>{currentStatus === "published" ? <form className="submission-form compact-form" onSubmit={submitEvidence}><label>Metric type<select name="metricType"><option value="revenue">Revenue</option><option value="visitors">Visitors</option><option value="outbound_clicks">Clicks</option><option value="bids">Bids</option><option value="other">Other</option></select></label><label>Public evidence URL<input type="url" name="evidenceUrl" required maxLength={2048} placeholder="https://example.com/open" /></label><label>Optional note<textarea name="note" maxLength={500} rows={3} placeholder="e.g. Public dashboard showing lifetime revenue" /></label><button className="button button-secondary" disabled={busy === "evidence"}>{busy === "evidence" ? "Submitting…" : "Submit for review"}</button></form> : <p>Available after approval.</p>}{evidenceItems.length ? <ul className="evidence-list">{evidenceItems.map((item) => <li key={item.id}><a href={item.url} target="_blank" rel="nofollow noopener noreferrer">{item.metricType.replaceAll("_", " ")}</a><span>{item.status.replaceAll("_", " ")}</span></li>)}</ul> : null}</details></div> : null}
  </>;
}
