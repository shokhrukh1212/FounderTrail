"use client";

import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

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

function BenefitIcon({ kind }: { kind: "image" | "edit" | "report" | "badge" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...common}>
    {kind === "image" ? <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m4.5 17 4.5-4.5 3.2 3.2 2.3-2.3 5 4.6" /></> : null}
    {kind === "edit" ? <><path d="M13.5 5.5 18.5 10.5" /><path d="m5 19 3.7-.8L19.4 7.5a1.8 1.8 0 0 0 0-2.5L19 4.6a1.8 1.8 0 0 0-2.5 0L5.8 15.3 5 19Z" /><path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" /></> : null}
    {kind === "report" ? <><path d="M4 20V10" /><path d="M4 20h17" /><path d="m6.5 15 4-4 3 2.5L20 6" /><path d="M16.5 6H20v3.5" /></> : null}
    {kind === "badge" ? <><path d="M12 3.2 14 5l2.7-.1.7 2.6 2.2 1.6-1.1 2.5 1.1 2.5-2.2 1.6-.7 2.6-2.7-.1-2 1.8-2-1.8-2.7.1-.7-2.6-2.2-1.6 1.1-2.5-1.1-2.5 2.2-1.6.7-2.6L10 5l2-1.8Z" /><circle cx="12" cy="11.5" r="2.5" /></> : null}
  </svg>;
}

export function SubmissionProOffer({ name, tagline, websiteUrl, logoUrl, selected, onSelect, price, configured, visible, submissionKey }: {
  name: string; tagline: string; websiteUrl: string; logoUrl: string | null;
  selected: boolean; onSelect: (value: boolean) => void; price: number; configured: boolean; visible: boolean; submissionKey: string;
}) {
  const [open, setOpen] = useState(false);
  const viewed = useRef(false);
  const shortName = Array.from(name || "your startup").slice(0, 60).join("");
  useEffect(() => {
    if (visible && submissionKey && !viewed.current) { viewed.current = true; trackSubmissionPro("pro_offer_viewed", submissionKey); }
  }, [visible, submissionKey]);
  return <section className="submission-pro-offer" aria-labelledby="submission-pro-heading">
    <div className="submission-pro-heading"><div><p className="eyebrow">Optional · Pro Launch</p><h3 id="submission-pro-heading">Give your launch a polished start.</h3><p>Turn your startup details into a launch kit you can make your own.</p></div><div className="submission-pro-price"><strong>${price / 100}</strong><span>one-time / startup</span></div></div>
    <ul className="submission-pro-benefits">{([
      ["image", "Editable launch images", "Personalize and download."],
      ["edit", "Ready-to-edit post drafts", "Make them sound like you."],
      ["report", "Seven-day launch report", "See your launch activity clearly."],
      ["badge", "A Pro badge on your startup", "Shows your Pro membership."],
    ] as const).map(([kind, title, description]) => <li key={title}><span><BenefitIcon kind={kind} /></span><div><strong>{title}</strong><p>{description}</p></div></li>)}</ul>
    <details onToggle={(event) => { const expanded = event.currentTarget.open; setOpen(expanded); if (expanded) trackSubmissionPro("pro_preview_opened", submissionKey); }}>
      <summary>Preview {shortName}’s launch kit</summary>
      {open ? <PreviewBoundary><Suspense fallback={<p role="status">Loading preview…</p>}><Preview name={shortName} tagline={tagline} websiteUrl={websiteUrl} logoUrl={logoUrl} /></Suspense></PreviewBoundary> : null}
    </details>
    <label className="submission-pro-choice" htmlFor="submission-pro-selected"><input id="submission-pro-selected" name="proSelected" type="checkbox" checked={selected} onChange={(event) => { onSelect(event.target.checked); if (event.target.checked) trackSubmissionPro("pro_selected", submissionKey); }} /><strong>Add Pro Launch</strong><span>${price / 100} once</span></label>
    <p className="field-help">{price === 500 ? "First 20 startup purchases: $5. Then $9. No subscription." : "Pro Launch is $9 per startup. No subscription."}</p>
    {!configured ? <p role="status">Pro is temporarily unavailable. You can still submit for free.</p> : <p className="field-help">Your page and launch go live independently of Pro checkout.</p>}
  </section>;
}
