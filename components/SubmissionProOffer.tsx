"use client";

import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { suggestedShortName } from "@/lib/display-text";

const Preview = lazy(() => import("./SubmissionLaunchPreview"));
class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="status">Preview couldn’t load. <button type="button" onClick={() => this.setState({ failed: false })}>Retry preview</button></p> : this.props.children; }
}

export function trackSubmissionPro(event: "pro_offer_viewed" | "pro_preview_opened" | "pro_selected", key: string) {
  if (!key) return;
  void fetch("/api/analytics", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event, eventId: `${event}:${key}` }), keepalive: true }).catch(() => {});
}

export function SubmissionProOffer({ name, tagline, websiteUrl, logoUrl, selected, onSelect, price, configured, visible, submissionKey }: {
  name: string; tagline: string; websiteUrl: string; logoUrl: string | null;
  selected: boolean; onSelect: (value: boolean) => void; price: number; configured: boolean; visible: boolean; submissionKey: string;
}) {
  const [open, setOpen] = useState(false);
  const viewed = useRef(false);
  const shortName = Array.from(suggestedShortName(name) || name || "your startup").slice(0, 60).join("");
  useEffect(() => {
    if (visible && submissionKey && !viewed.current) { viewed.current = true; trackSubmissionPro("pro_offer_viewed", submissionKey); }
  }, [visible, submissionKey]);
  return <section className="submission-pro-offer" aria-labelledby="submission-pro-heading">
    <div className="submission-pro-heading"><div><p className="eyebrow">Optional · Pro Launch</p><h3 id="submission-pro-heading">Give your launch a polished start.</h3><p>Turn your startup details into a launch kit you can make your own.</p></div><div className="submission-pro-price"><strong>${price / 100}</strong><span>one-time / startup</span></div></div>
    <ul className="submission-pro-benefits">{[
      ["▧", "Editable launch images", "Personalize and download."],
      ["✎", "Ready-to-edit post drafts", "Make them sound like you."],
      ["▥", "Seven-day launch report", "See your launch activity clearly."],
      ["☆", "A Pro badge on your startup", "Shows your Pro membership."],
    ].map(([icon, title, description]) => <li key={title}><span aria-hidden="true">{icon}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ul>
    <details onToggle={(event) => { const expanded = event.currentTarget.open; setOpen(expanded); if (expanded) trackSubmissionPro("pro_preview_opened", submissionKey); }}>
      <summary>Preview {shortName}’s launch kit</summary>
      {open ? <PreviewBoundary><Suspense fallback={<p role="status">Loading preview…</p>}><Preview name={shortName} tagline={tagline} websiteUrl={websiteUrl} logoUrl={logoUrl} /></Suspense></PreviewBoundary> : null}
    </details>
    <label className="submission-pro-choice" htmlFor="submission-pro-selected"><input id="submission-pro-selected" name="proSelected" type="checkbox" checked={selected} disabled={!configured} onChange={(event) => { onSelect(event.target.checked); if (event.target.checked) trackSubmissionPro("pro_selected", submissionKey); }} /><strong>Add Pro Launch</strong><span>${price / 100} once</span></label>
    <p className="field-help">{price === 500 ? "First 20 startup purchases: $5. Then $9. No subscription." : "Pro Launch is $9 per startup. No subscription."}</p>
    {!configured ? <p role="status">Pro is temporarily unavailable. You can still submit for free.</p> : <p className="field-help">All submissions are reviewed. If your startup is rejected, we’ll refund your Pro purchase.</p>}
  </section>;
}
