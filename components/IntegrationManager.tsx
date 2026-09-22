"use client";

import { useState } from "react";

export type IntegrationState = {
  publicId: string;
  allowedDomain: string;
  verificationToken: string;
  domainStatus: string;
  domainVerifiedAt: string | null;
  domainLastCheckedAt: string | null;
  domainCheckOutcome: string | null;
  verificationMethod: "meta" | "file";
  badgeStatus: string;
  badgeInstalledAt: string | null;
  badgeLastCheckedAt: string | null;
  badgeLastSeenAt: string | null;
  lastVisitorEventAt: string | null;
  productVerifiedAt: string | null;
  lastEventAt: string | null;
  hasSecret: boolean;
} | null;

type Notice = { text: string; tone: "success" | "error" } | null;
type StatusTone = "neutral" | "waiting" | "active" | "failed";

function CopyButton({ value, label, copyKey, copiedKey, onCopy }: { value: string; label: string; copyKey: string; copiedKey: string; onCopy: (value: string, key: string) => void }) {
  const copied = copiedKey === copyKey;
  return <button className="copy-value-button" type="button" onClick={() => onCopy(value, copyKey)} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
    {copied ? <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m4 10 3.5 3.5L16 5" /></svg> : <svg aria-hidden="true" viewBox="0 0 20 20"><rect x="7" y="3" width="9" height="11" rx="2" /><path d="M13 16v1H5a2 2 0 0 1-2-2V7h1" /></svg>}
    <span>{copied ? "Copied" : "Copy"}</span>
  </button>;
}

function CopyBlock(props: { value: string; label: string; copyKey: string; copiedKey: string; onCopy: (value: string, key: string) => void }) {
  return <div className="copy-value-block"><pre>{props.value}</pre><CopyButton {...props} /></div>;
}

function Status({ label, value, tone, detail }: { label: string; value: string; tone: StatusTone; detail: string }) {
  return <div className="verification-status-item"><span>{label}</span><strong className={`status-dot status-${tone}`}>{value}</strong><small>{detail}</small></div>;
}

function localTime(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

export function IntegrationManager({ slug, initial, siteUrl, websiteUrl }: { slug: string; initial: IntegrationState; siteUrl: string; websiteUrl: string }) {
  const [integration, setIntegration] = useState(initial);
  const [secret, setSecret] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [busy, setBusy] = useState("");
  const [method, setMethod] = useState<"meta" | "file">(initial?.verificationMethod ?? "meta");
  const [badgeStyle, setBadgeStyle] = useState<"light" | "dark" | "compact">("light");

  async function copyValue(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? "" : current), 1800);
    } catch { setNotice({ text: "Could not copy automatically. Select the value and copy it manually.", tone: "error" }); }
  }

  async function request(path: string, body?: object) {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "The request could not be completed.");
    return data;
  }

  async function createIntegration() {
    setBusy("create"); setNotice(null);
    try { await request(`/api/owner/products/${encodeURIComponent(slug)}/integration`, { action: "create" }); window.location.reload(); }
    catch (error) { setNotice({ text: error instanceof Error ? error.message : "Could not start verification.", tone: "error" }); setBusy(""); }
  }

  async function verifyDomain() {
    setBusy("domain"); setNotice(null);
    try {
      const data = await request(`/api/owner/products/${encodeURIComponent(slug)}/verify-domain`, { method });
      setIntegration((current) => current ? { ...current, domainStatus: "verified", domainVerifiedAt: data.verifiedAt as string, domainLastCheckedAt: data.checkedAt as string, domainCheckOutcome: "verified", verificationMethod: method, productVerifiedAt: data.productVerifiedAt as string | null } : current);
      setNotice({ text: "Domain ownership verified.", tone: "success" });
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "Domain verification failed.", tone: "error" }); }
    finally { setBusy(""); }
  }

  async function checkBadge() {
    setBusy("badge"); setNotice(null);
    try {
      const data = await request(`/api/owner/products/${encodeURIComponent(slug)}/check-badge`);
      setIntegration((current) => current ? { ...current, badgeStatus: "active", badgeInstalledAt: data.installedAt as string, badgeLastCheckedAt: data.checkedAt as string, productVerifiedAt: data.productVerifiedAt as string | null } : current);
      setNotice({ text: data.productVerifiedAt ? "Badge found. Your product is now verified." : "Badge found. Verify the domain to complete product verification.", tone: "success" });
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "Badge installation was not found.", tone: "error" }); }
    finally { setBusy(""); }
  }

  async function manageSecret(action: "create_secret" | "rotate") {
    if (action === "rotate" && !window.confirm("Rotate the server secret? The old secret will stop working immediately.")) return;
    setBusy("secret"); setNotice(null);
    try {
      const data = await request(`/api/owner/products/${encodeURIComponent(slug)}/integration`, { action });
      setSecret(data.secret as string);
      setIntegration((current) => current ? { ...current, hasSecret: true } : current);
      setNotice({ text: "New server secret created. Copy it now; it cannot be recovered.", tone: "success" });
    } catch (error) { setNotice({ text: error instanceof Error ? error.message : "Could not create the secret.", tone: "error" }); }
    finally { setBusy(""); }
  }

  if (!integration) return <section className="manager-card integration-setup">
    <p className="step-label">Verification & data</p><h2>Verify your product</h2>
    <p>Start with domain ownership and the FounderTrail badge. Revenue integration is optional and is not required for a Verified product.</p>
    <button className="button button-primary" disabled={busy === "create"} onClick={createIntegration}>{busy === "create" ? "Starting…" : "Start verification"}</button>
    {notice ? <p className={`manager-notice is-${notice.tone}`}>{notice.text}</p> : null}
  </section>;

  const verificationUrl = `https://${integration.allowedDomain}/.well-known/bidindex-verification.txt`;
  const metaTag = `<meta name="bidindex-verification" content="${integration.verificationToken}">`;
  const snippet = `<script async src="${siteUrl}/embed/badge.js" data-project="${integration.publicId}" data-style="${badgeStyle}"></script>`;
  const eventEndpoint = `${siteUrl}/api/partner/v1/events`;
  const eventExample = `curl --request POST "${eventEndpoint}" \\
  --header "Authorization: Bearer YOUR_SERVER_SECRET" \\
  --header "Content-Type: application/json" \\
  --data '{
    "project_id": "${integration.publicId}",
    "event_id": "order_12345678",
    "type": "purchase",
    "occurred_at": "CURRENT_UTC_TIMESTAMP",
    "amount_minor": 12700,
    "currency": "USD"
  }'`;
  const copyProps = { copiedKey, onCopy: copyValue };
  const domainActive = Boolean(integration.domainVerifiedAt);
  const badgeActive = Boolean(integration.badgeInstalledAt);
  const visitorActive = Boolean(integration.lastVisitorEventAt);
  const revenueActive = Boolean(integration.lastEventAt);

  return <div className="integration-manager">
    <section className={`product-verification-summary ${integration.productVerifiedAt ? "is-verified" : ""}`}>
      <div><span className="verified-mark" aria-hidden="true">✓</span><div><strong>{integration.productVerifiedAt ? "Optional site tracker active" : "Optional site tracker not fully connected"}</strong><p>This tracker status records the domain and badge installation. Account ownership and each published metric are verified and labelled separately.</p></div></div>
    </section>
    <div className="verification-status-grid">
      <Status label="Domain ownership" value={domainActive ? "Active" : integration.domainStatus === "failed" ? "Failed" : "Not started"} tone={domainActive ? "active" : integration.domainStatus === "failed" ? "failed" : "neutral"} detail={`Last check: ${localTime(integration.domainLastCheckedAt)}`} />
      <Status label="Badge installation" value={badgeActive ? "Active" : integration.badgeStatus === "failed" ? "Failed" : domainActive ? "Waiting" : "Not started"} tone={badgeActive ? "active" : integration.badgeStatus === "failed" ? "failed" : domainActive ? "waiting" : "neutral"} detail={`Last check: ${localTime(integration.badgeLastCheckedAt)}`} />
      <Status label="Visitor tracking" value={visitorActive ? "Active" : badgeActive ? "Waiting" : "Not started"} tone={visitorActive ? "active" : badgeActive ? "waiting" : "neutral"} detail={visitorActive ? `Last event: ${localTime(integration.lastVisitorEventAt)}` : "Begins after the badge loads"} />
      <Status label="Revenue connection" value={revenueActive ? "Active" : integration.hasSecret ? "Waiting" : "Optional"} tone={revenueActive ? "active" : integration.hasSecret ? "waiting" : "neutral"} detail={revenueActive ? `Last event: ${localTime(integration.lastEventAt)}` : "Not required for verification"} />
    </div>
    {notice ? <p className={`manager-notice is-${notice.tone}`} role="status">{notice.text}</p> : null}

    <section className="manager-card integration-instructions">
      <p className="step-label">1 · Verify domain ownership</p><h2>Add a verification tag</h2>
      <p>This confirms control of <strong>{integration.allowedDomain}</strong>. It does not verify revenue, traffic, purchases, or bids.</p>
      <div className="segmented-control" role="group" aria-label="Domain verification method">
        <button type="button" className={method === "meta" ? "is-active" : ""} onClick={() => setMethod("meta")}>Meta tag · Recommended</button>
        <button type="button" className={method === "file" ? "is-active" : ""} onClick={() => setMethod("file")}>Text file</button>
      </div>
      {method === "meta" ? <>
        <p className="form-hint">Paste this tag inside the <code>&lt;head&gt;</code> of the website at <a href={websiteUrl} target="_blank" rel="noopener noreferrer nofollow">your approved URL ↗</a>, deploy, then check verification.</p>
        <CopyBlock value={metaTag} label="verification meta tag" copyKey="meta-tag" {...copyProps} />
      </> : <>
        <p className="form-hint">Publish a plain-text file containing only the token at the URL below, deploy, and confirm the URL opens before checking.</p>
        <div className="integration-value"><strong>Verification URL</strong><CopyBlock value={verificationUrl} label="verification URL" copyKey="verification-url" {...copyProps} /></div>
        <div className="integration-value"><strong>File contents</strong><CopyBlock value={integration.verificationToken} label="verification token" copyKey="verification-token" {...copyProps} /></div>
      </>}
      <div className="integration-action-row"><button className="button button-secondary" disabled={busy === "domain"} onClick={verifyDomain}>{busy === "domain" ? "Checking…" : "Check verification"}</button><span>Verified: {localTime(integration.domainVerifiedAt)}</span></div>
    </section>

    <section className="manager-card integration-instructions">
      <p className="step-label">2 · Install the optional FounderTrail badge</p><h2>Choose a badge style</h2>
      <p>Place the badge anywhere appropriate on your product site. The public project ID is safe for browser code; server secrets are never included.</p>
      <div className="integration-value"><strong>Public project ID</strong><CopyBlock value={integration.publicId} label="public project ID" copyKey="project-id" {...copyProps} /></div>
      <div className="segmented-control" role="group" aria-label="Badge style">
        {(["light", "dark", "compact"] as const).map((style) => <button type="button" key={style} className={badgeStyle === style ? "is-active" : ""} onClick={() => setBadgeStyle(style)}>{style}</button>)}
      </div>
      <div className={`badge-preview badge-${badgeStyle}`}><span>{badgeStyle === "compact" ? "Live on FounderTrail" : integration.productVerifiedAt ? "Live on FounderTrail · Verified product" : "Live on FounderTrail"}</span></div>
      <CopyBlock value={snippet} label="badge code" copyKey="badge-snippet" {...copyProps} />
      <details className="installation-help"><summary>Installation help</summary><p>HTML: paste the snippet before <code>&lt;/body&gt;</code>. Next.js or React: render it with the framework&apos;s script component after interactive hydration. Website builders: use a custom HTML/embed block. Deploy before checking.</p><p>The script measures pageviews, approximate daily unique visitors, and badge impressions. It does not read page content, forms, host cookies, local storage, query strings, or fragments.</p></details>
      <div className="integration-action-row"><button className="button button-secondary" disabled={busy === "badge"} onClick={checkBadge}>{busy === "badge" ? "Checking…" : "Check installation"}</button><span>Installed: {localTime(integration.badgeInstalledAt)}</span></div>
    </section>

    <section className="manager-card integration-instructions">
      <p className="step-label">Optional</p><h2>Connect revenue and product events</h2>
      <p>Domain verification and the badge activate this optional site tracker. They do not verify revenue and are separate from the account ownership claim. Connect your server only if you want to display source-labelled product events.</p>
      <dl className="product-facts compact-facts"><div><dt>Connection</dt><dd>{integration.hasSecret ? "Secret created" : "Not connected"}</dd></div><div><dt>Last accepted event</dt><dd>{localTime(integration.lastEventAt)}</dd></div></dl>
      {secret ? <div className="secret-once"><strong>Copy this server secret now</strong><p>It is shown once and cannot be recovered. Store it only in your server&apos;s encrypted environment settings.</p><CopyBlock value={secret} label="server secret" copyKey="server-secret" {...copyProps} /></div> : null}
      <div className="integration-action-row"><button className="button button-secondary" disabled={busy === "secret"} onClick={() => manageSecret(integration.hasSecret ? "rotate" : "create_secret")}>{busy === "secret" ? "Working…" : integration.hasSecret ? "Rotate server secret" : "Create server secret"}</button></div>
      <details className="installation-help"><summary>Documentation and code example</summary><p>Send events from your server over HTTPS. Authentication confirms which partner sent the data; it does not independently audit the founder&apos;s business.</p><CopyBlock value={eventExample} label="server event example" copyKey="event-example" {...copyProps} /><ul className="integration-notes"><li>Replace <code>YOUR_SERVER_SECRET</code> and <code>CURRENT_UTC_TIMESTAMP</code>.</li><li>Use integer minor units: <code>12700</code> means USD 127.00.</li><li>Never send customer names, emails, card information, or other personal data.</li><li>Use one stable event ID for retries so duplicate events cannot inflate totals.</li></ul></details>
    </section>
  </div>;
}
