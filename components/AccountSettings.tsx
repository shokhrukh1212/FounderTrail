"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AccountSettings({ initialDigest }: { initialDigest: boolean }) {
  const router = useRouter();
  const [digest, setDigest] = useState(initialDigest);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    const response = await fetch("/api/account/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ digestOptedIn: digest }) });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Preferences saved." : result.error ?? "Could not save preferences."); setBusy(false);
  }
  async function removeAccount() {
    if (!window.confirm("Delete your FounderTrail account? An administrator must transfer or release managed products first. This signs you out and cannot be undone.")) return;
    setDeleting(true); setMessage("");
    const response = await fetch("/api/account/settings", { method: "DELETE" });
    const result = await response.json() as { error?: string };
    if (!response.ok) { setMessage(result.error ?? "Could not delete this account."); setDeleting(false); return; }
    await authClient.signOut().catch(() => undefined);
    router.replace("/");
    router.refresh();
  }
  return <><section className="settings-card"><h2>Email preferences</h2><label className="consent-row settings-option"><input type="checkbox" checked={digest} onChange={(event) => setDigest(event.target.checked)} /><span className="consent-copy"><strong>Weekly followed-products digest</strong><small>One summary of eligible updates from products you follow. Off by default; no promotional subscription is added.</small></span></label><div className="settings-actions"><button className="button button-primary" disabled={busy} onClick={() => void save()}>Save preferences</button></div>{message ? <p role="status">{message}</p> : null}</section><section className="settings-card danger-zone"><h2>Delete account</h2><p>Your login, sessions, provider credentials, name, and email are removed. Public comments become attributed to “Deleted member.” Required moderation, audit, and payment records remain. Ask an administrator to transfer or release managed products first.</p><button className="button button-secondary" type="button" disabled={deleting} onClick={() => void removeAccount()}>{deleting ? "Deleting…" : "Delete my account"}</button></section></>;
}
