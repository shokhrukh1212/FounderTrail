"use client";

import { useState } from "react";

export type ApprovalEmailState = {
  status: string;
  sentAt: string | null;
  providerId: string | null;
  warning?: string;
};

export type ApprovalNoticeData = {
  slug: string;
  name: string;
  publicUrl: string;
  approvedAt: string;
  email: ApprovalEmailState;
};

export function ApprovalNotice({ initial }: { initial: ApprovalNoticeData }) {
  const [item, setItem] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    await navigator.clipboard.writeText(item.publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function retry() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(item.slug)}/approval-email`, { method: "POST" });
      const result = await response.json().catch(() => ({})) as { error?: string; email?: ApprovalEmailState };
      if (!response.ok || !result.email) throw new Error(result.error || result.email?.warning || "Could not resend the approval email.");
      setItem((current) => ({ ...current, email: result.email! }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend the approval email.");
    } finally {
      setBusy(false);
    }
  }

  const emailSent = item.email.status === "sent" || item.email.status === "already_sent";
  const canRetry = item.email.status === "failed" || item.email.status === "not_sent" || item.email.status === "skipped";
  return <article className="approval-notice" aria-live="polite">
    <div>
      <strong>Product published</strong>
      <h3>{item.name}</h3>
      <p>Approval email: <span className={emailSent ? "verified-text" : "muted-text"}>{emailSent ? `Sent${item.email.sentAt ? ` ${new Date(item.email.sentAt).toLocaleString()}` : ""}` : item.email.status.replaceAll("_", " ")}</span></p>
      {item.email.warning ? <p className="approval-warning">{item.email.warning}</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </div>
    <div className="approval-notice-actions">
      <a className="button button-secondary" href={item.publicUrl} target="_blank" rel="noopener noreferrer">View product</a>
      <button className="button button-secondary" type="button" onClick={copy}>{copied ? "Copied" : "Copy product link"}</button>
      {canRetry ? <button className="button button-primary" type="button" disabled={busy} onClick={retry}>{busy ? "Sending…" : "Resend approval email"}</button> : null}
    </div>
  </article>;
}

export function ApprovalNotifications({ items }: { items: ApprovalNoticeData[] }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  async function sendBacklog() {
    if (!window.confirm("Send approval emails to every published product that has not received one yet? Repeating this action is safe.")) return;
    setBusy(true); setResult("");
    try {
      const response = await fetch("/api/admin/approval-emails", { method: "POST" });
      const body = await response.json().catch(() => ({})) as { error?: string; sent?: number; alreadySent?: number; failed?: number };
      if (!response.ok) throw new Error(body.error || "Could not send approval emails.");
      setResult(`${body.sent ?? 0} sent, ${body.alreadySent ?? 0} already sent, ${body.failed ?? 0} failed.`);
      window.setTimeout(() => window.location.reload(), 1800);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Could not send approval emails.");
      setBusy(false);
    }
  }
  return <section className="admin-approval-notifications">
    <div className="admin-section-heading"><div><h2>Published products</h2><p>Recent publication and approval-email status.</p></div><button className="button button-secondary" type="button" disabled={busy} onClick={sendBacklog}>{busy ? "Sending…" : "Send pending approval emails"}</button></div>
    {result ? <p className="manager-notice" role="status">{result}</p> : null}
    <div className="approval-notice-list">{items.length ? items.map((item) => <ApprovalNotice key={item.slug} initial={item} />) : <div className="quiet-empty">No published products yet.</div>}</div>
  </section>;
}
