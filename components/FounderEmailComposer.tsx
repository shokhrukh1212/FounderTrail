"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AudienceReview } from "@/lib/founder-email-audience";
import { PERSONALIZATION_TOKEN_LABELS, PERSONALIZATION_TOKENS, type CampaignTemplateKey } from "@/lib/email-templates";
import type { CampaignDraft } from "@/lib/founder-email-campaigns";

type Product = { id: string; name: string; founderName: string | null; status: string };
type Props = { campaignId?: string; initial: CampaignDraft; templates: Array<{ key: CampaignTemplateKey; label: string; draft: CampaignDraft }>; products: Product[]; foundertrailLaunchAt?: string | null };
type EditableKey = "subject" | "previewText" | "heading" | "body" | "primaryButtonLabel" | "primaryButtonUrl" | "secondaryButtonLabel" | "secondaryButtonUrl";
type Preview = { html: string; previewRecipient: { kind: "selected" | "example"; label: string; email: string | null; eligible: boolean } };

const messageTypeLabel = (value: CampaignDraft["messageClass"]) => value === "marketing" ? "Marketing/growth" : "Product/owner update";

export function FounderEmailComposer({ campaignId, initial, templates, products, foundertrailLaunchAt = null }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mode, setMode] = useState<"desktop" | "mobile">("desktop");
  const [reviewData, setReviewData] = useState<AudienceReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [activeSelection, setActiveSelection] = useState<{ key: EditableKey; start: number; end: number } | null>(null);
  const selected = new Set(draft.audience.productIds ?? []);

  function field<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) { setDraft(current => ({ ...current, [key]: value })); }
  function audience(value: Partial<CampaignDraft["audience"]>) { setDraft(current => ({ ...current, audience: { ...current.audience, ...value } })); }

  useEffect(() => {
    const timer = setTimeout(() => fetch("/api/admin/founder-emails/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ draft, mode }) }).then(async response => response.ok ? await response.json() as Preview : null).then(setPreview).catch(() => setPreview(null)), 250);
    return () => clearTimeout(timer);
  }, [draft, mode]);

  useEffect(() => {
    const timer = setTimeout(() => fetch("/api/admin/founder-emails/audience", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ audience: draft.audience, messageClass: draft.messageClass, productSpecific: draft.productSpecific, templateKey: draft.templateKey }) }).then(async response => response.ok ? await response.json() as AudienceReview : null).then(setReviewData).catch(() => setReviewData(null)), 250);
    return () => clearTimeout(timer);
  }, [draft.audience, draft.messageClass, draft.productSpecific, draft.templateKey]);

  const selectedTemplate = useMemo(() => templates.find(item => item.key === draft.templateKey), [draft.templateKey, templates]);
  function editorProps(key: EditableKey) {
    const remember = (event: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => { const editor = event.currentTarget; setActiveSelection({ key, start: editor.selectionStart ?? editor.value.length, end: editor.selectionEnd ?? editor.value.length }); };
    return { "data-editor-key": key, onFocus: remember, onSelect: remember };
  }
  function insertToken(token: string) {
    if (!activeSelection) { setNotice("Choose an email field, then insert a value."); return; }
    const { key, start, end } = activeSelection; const value = String(draft[key]); const inserted = `{${token}}`; field(key, `${value.slice(0, start)}${inserted}${value.slice(end)}`); const cursor = start + inserted.length; setActiveSelection({ key, start: cursor, end: cursor });
    requestAnimationFrame(() => { const editor = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[data-editor-key="${key}"]`); editor?.focus(); editor?.setSelectionRange(cursor, cursor); });
  }
  async function save() {
    setBusy(true); setNotice("");
    const response = await fetch(campaignId ? `/api/admin/founder-emails/campaigns/${campaignId}` : "/api/admin/founder-emails/campaigns", { method: campaignId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) });
    const body = await response.json(); setBusy(false);
    if (!response.ok) { setNotice(body.error ?? "Could not save draft."); return null; }
    const id = campaignId ?? body.id; setNotice("Draft saved."); if (!campaignId) router.replace(`/admin/founder-emails/${id}`); router.refresh(); return id;
  }
  async function review() { const id = await save(); if (id) router.push(`/admin/founder-emails/${id}/confirm`); }
  async function test() {
    const id = campaignId ?? await save(); if (!id || !testEmail) return; setBusy(true);
    const response = await fetch(`/api/admin/founder-emails/campaigns/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "test", email: testEmail }) });
    setNotice(response.ok ? "Test email sent." : "Test email could not be sent."); setBusy(false);
  }

  const statusValue = (draft.audience.statuses ?? ["published"]).join(",");
  const launchDate = foundertrailLaunchAt ? new Date(foundertrailLaunchAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
  const exclusionReasons = Object.entries((reviewData?.exclusions ?? []).flatMap(item => item.reasons).reduce<Record<string, number>>((counts, reason) => ({ ...counts, [reason]: (counts[reason] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const customTemplate = draft.templateKey === "custom_announcement";
  return <div className="email-composer-layout">
    <section className="email-composer">
      <section className="manager-card campaign-step" aria-labelledby="choose-founders">
        <div className="campaign-step-heading"><span>1</span><div><h2 id="choose-founders">Choose founders</h2><p>Select products first. Email protections are applied automatically.</p></div></div>
        <div className="form-grid-three">
          <label>Search product, founder, or private email<input value={draft.audience.search ?? ""} onChange={event => audience({ search: event.target.value })}/></label>
          <label>Status<select value={statusValue} onChange={event => audience({ statuses: event.target.value.split(",") as CampaignDraft["audience"]["statuses"] })}><option value="published">Published</option><option value="pending">Pending</option><option value="published,pending">Published and pending</option><option value="rejected">Rejected</option><option value="archived">Archived</option><option value="draft,pending,published,rejected,archived">All statuses</option></select></label>
          <label>Verification<select value={draft.audience.verification ?? "all"} onChange={event => audience({ verification: event.target.value as CampaignDraft["audience"]["verification"] })}><option value="all">Any verification</option><option value="verified">Verified</option><option value="not_verified">Not verified</option><option value="domain_badge_missing">Domain verified, badge missing</option></select></label>
        </div>
        <div className="form-grid">
          <label>Founder group<select value={draft.audience.founderGroup ?? "all"} onChange={event => audience({ founderGroup: event.target.value as CampaignDraft["audience"]["founderGroup"] })}><option value="all">All founders</option><option value="biddex">Biddex founders{launchDate ? ` (submitted before ${launchDate})` : ""}</option><option value="foundertrail">FounderTrail founders{launchDate ? ` (submitted ${launchDate} or later)` : ""}</option></select></label>
          <label>Share activity<select value={draft.audience.shareIntent ?? "all"} onChange={event => audience({ shareIntent: event.target.value as CampaignDraft["audience"]["shareIntent"] })}><option value="all">Any activity</option><option value="has">Has share-intent activity</option><option value="none">No share-intent activity</option></select></label>
        </div>
        <label className="checkbox-row"><input type="checkbox" checked={draft.audience.selectAll === true} onChange={event => audience({ selectAll: event.target.checked, productIds: event.target.checked ? [] : draft.audience.productIds })}/> Select all eligible founders matching these filters</label>
        {!draft.audience.selectAll ? <div className="campaign-product-picker">{products.map(product => <label key={product.id}><input type="checkbox" checked={selected.has(product.id)} onChange={event => { const ids = new Set(selected); if (event.target.checked) ids.add(product.id); else ids.delete(product.id); audience({ productIds: [...ids] }); }}/><span><strong>{product.name}</strong><small>{product.founderName || "Founder not provided"} · {product.status}</small></span></label>)}</div> : null}
        <div className="recipient-summary-grid"><span><strong>{reviewData?.selectedCount ?? "—"}</strong><small>Founders selected</small></span><span><strong>{reviewData?.eligibleCount ?? "—"}</strong><small>Eligible</small></span><span><strong>{reviewData?.excludedCount ?? "—"}</strong><small>Excluded</small></span></div>
        {exclusionReasons.length ? <p className="field-help">Excluded because: {exclusionReasons.map(([reason, count]) => `${reason} (${count})`).join(" · ")}. The full list is in step 3.</p> : null}
        {draft.messageClass === "marketing" ? <p className="marketing-consent-summary"><strong>{reviewData?.marketingAudience.eligible ?? "—"} of {reviewData?.marketingAudience.total ?? "—"} founders</strong> can receive growth emails. Founders who explicitly unsubscribed, or whose address has a delivery suppression, are always excluded.</p> : <p className="manager-notice">Product/owner updates do not require marketing consent. Bounce, complaint, provider, and manual delivery suppressions still apply.</p>}
      </section>

      <section className="manager-card campaign-step" aria-labelledby="write-email">
        <div className="campaign-step-heading"><span>2</span><div><h2 id="write-email">Write email</h2><p>Every eligible founder receives a separate personalized message.</p></div></div>
        <div className="form-grid">
          <label>Template<select value={draft.templateKey} onChange={event => { const next = templates.find(item => item.key === event.target.value); if (next) setDraft({ ...next.draft, audience: draft.audience, internalName: draft.internalName || next.draft.internalName }); }}>{templates.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          {customTemplate ? <label>Message type<select value={draft.messageClass} onChange={event => field("messageClass", event.target.value as CampaignDraft["messageClass"])}><option value="marketing">Marketing/growth</option><option value="transactional">Product/owner update</option></select><small className="field-help">Choose based on the purpose of this message.</small></label> : <div className="fixed-message-type" role="status"><span>Message type</span><strong>{messageTypeLabel(draft.messageClass)}</strong><small>Fixed by the selected template. Choose Custom announcement to select a different type.</small></div>}
          <label>Internal campaign name<input value={draft.internalName} onChange={event => field("internalName", event.target.value)}/></label>
          <label>Send now or schedule<input type="datetime-local" value={draft.scheduledAt?.slice(0, 16) ?? ""} onChange={event => field("scheduledAt", event.target.value ? new Date(event.target.value).toISOString() : null)}/></label>
        </div>
        <div className="token-insert"><label>Insert value<select aria-label="Insert value" value="" onChange={event => { if (event.target.value) insertToken(event.target.value); }}><option value="">Choose a value…</option>{PERSONALIZATION_TOKENS.map(token => <option key={token} value={token}>{`${PERSONALIZATION_TOKEN_LABELS[token]} — {${token}}`}</option>)}</select></label><small>Click in a field first; the value is inserted at the cursor.</small></div>
        <div className="form-grid"><label>Subject<input {...editorProps("subject")} value={draft.subject} onChange={event => field("subject", event.target.value)}/></label><label>Preview text<input {...editorProps("previewText")} value={draft.previewText} onChange={event => field("previewText", event.target.value)}/></label></div>
        <label>Heading<input {...editorProps("heading")} value={draft.heading} onChange={event => field("heading", event.target.value)}/></label>
        <label>Body<textarea {...editorProps("body")} rows={14} value={draft.body} onChange={event => field("body", event.target.value)}/></label>
        <label className="checkbox-row"><input type="checkbox" checked={draft.includeProductLogo} onChange={event => field("includeProductLogo", event.target.checked)}/> Include product logo</label>
        <div className="form-grid">
          <label>Primary button label<input {...editorProps("primaryButtonLabel")} value={draft.primaryButtonLabel} onChange={event => field("primaryButtonLabel", event.target.value)}/></label><label>Primary button URL<input {...editorProps("primaryButtonUrl")} value={draft.primaryButtonUrl} onChange={event => field("primaryButtonUrl", event.target.value)}/></label>
          <label>Secondary button label<input {...editorProps("secondaryButtonLabel")} value={draft.secondaryButtonLabel} onChange={event => field("secondaryButtonLabel", event.target.value)}/></label><label>Secondary button URL<input {...editorProps("secondaryButtonUrl")} value={draft.secondaryButtonUrl} onChange={event => field("secondaryButtonUrl", event.target.value)}/></label>
          <label>Sender name<input value={draft.senderName} onChange={event => field("senderName", event.target.value)}/></label><label>Reply-To<input type="email" value={draft.replyTo} onChange={event => field("replyTo", event.target.value)}/></label>
        </div>
      </section>

      <section className="manager-card campaign-step" aria-labelledby="review-send">
        <div className="campaign-step-heading"><span>3</span><div><h2 id="review-send">Review and send</h2><p>Check every recipient and exclusion before final confirmation.</p></div></div>
        {reviewData?.recipients.length ? <div className="campaign-review-list"><h3>Final recipients</h3>{reviewData.recipients.map(item => <article key={item.email}><div><strong>{item.founderName || "Founder not provided"}</strong><span>{item.email}</span></div><div><strong>{item.product.name}</strong>{item.groupedProducts.length > 1 ? <small>One email · also owns {item.groupedProducts.slice(1).map(product => product.name).join(", ")}</small> : null}</div></article>)}</div> : <p className="compact-empty">No eligible recipients yet.</p>}
        {reviewData?.exclusions.length ? <details className="campaign-exclusions"><summary>{reviewData.excludedCount} excluded founder{reviewData.excludedCount === 1 ? "" : "s"}</summary>{reviewData.exclusions.map((item, index) => <article key={`${item.product.id}-${index}`}><strong>{item.founderName || "Founder not provided"} · {item.product.name}</strong><span>{item.email}</span><small>{item.reasons.join("; ")}</small></article>)}</details> : null}
        <div className="campaign-actions"><button className="button" disabled={busy} onClick={save}>Save draft</button><button className="button button-primary" disabled={busy || !reviewData?.eligibleCount} onClick={review}>Review and confirm</button></div>
        <div className="test-email-row"><input type="email" placeholder="Test recipient email" value={testEmail} onChange={event => setTestEmail(event.target.value)}/><button className="button" disabled={busy || !testEmail} onClick={test}>Send test email</button></div>
        {notice ? <p className="manager-notice" role="status">{notice}</p> : null}
      </section>
    </section>
    <aside className="email-preview-panel"><div className="email-preview-heading"><div><strong>Email preview</strong><small className={preview?.previewRecipient.kind === "example" ? "is-example" : ""}>{preview?.previewRecipient.label ?? "Preparing preview…"}</small></div><div className="segmented-control"><button className={mode === "desktop" ? "is-active" : ""} onClick={() => setMode("desktop")}>Desktop</button><button className={mode === "mobile" ? "is-active" : ""} onClick={() => setMode("mobile")}>Mobile</button></div></div><div className={`email-preview-frame is-${mode}`}><iframe title={`${selectedTemplate?.label ?? "Campaign"} ${mode} preview`} srcDoc={preview?.html ?? ""}/></div></aside>
  </div>;
}
