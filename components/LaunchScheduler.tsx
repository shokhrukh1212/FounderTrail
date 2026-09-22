"use client";
import { useState } from "react";

export function LaunchScheduler({ slug }: { slug: string }) {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  const [date, setDate] = useState(monday.toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function schedule() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/owner/products/${encodeURIComponent(slug)}/launch`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekStartsAt: `${date}T00:00:00.000Z` }) });
    const result = await response.json() as { error?: string };
    setMessage(response.ok ? "Launch scheduled." : result.error ?? "Could not schedule.");
    setBusy(false);
    if (response.ok) location.reload();
  }

  return <div className="launch-scheduler">
    <div className="form-field">
      <label htmlFor="launch-week">Launch week</label>
      <input id="launch-week" type="date" value={date} min={monday.toISOString().slice(0, 10)} onChange={(event) => setDate(event.target.value)} aria-describedby="launch-week-help" />
      <small id="launch-week-help" className="field-help">Weeks begin Monday 00:00 UTC and end the following Monday at 00:00 UTC. Joining the current week does not give seven full days.</small>
    </div>
    <div className="settings-actions">
      <button className="button button-primary" disabled={busy} onClick={() => void schedule()}>{busy ? "Scheduling…" : "Schedule first launch"}</button>
    </div>
    {message ? <p role="status" className="form-hint">{message}</p> : null}
  </div>;
}
