"use client";
import { useMemo, useState } from "react";

const DAY = 24 * 60 * 60 * 1000;
/** Matches the API: this week's Monday through Mondays within six months. */
const WEEKS_AHEAD = 25;

export function launchWeeks(now: Date) {
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const format = (time: number) => new Date(time).toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric" });
  return Array.from({ length: WEEKS_AHEAD + 1 }, (_, index) => {
    const start = monday + index * 7 * DAY;
    const label = `${format(start)} – ${format(start + 7 * DAY)}, ${new Date(start).getUTCFullYear()}`;
    return { value: new Date(start).toISOString(), label: index === 0 ? `This week (${label})` : label };
  });
}

export function LaunchScheduler({ slug }: { slug: string }) {
  const weeks = useMemo(() => launchWeeks(new Date()), []);
  // Default to next week so a new launch gets all seven days.
  const [weekStartsAt, setWeekStartsAt] = useState(weeks[1].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function schedule() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/owner/products/${encodeURIComponent(slug)}/launch`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekStartsAt }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (response.ok) { location.reload(); return; }
      setError(result.error ?? "Could not schedule the launch. Please try again.");
    } catch {
      setError("Could not reach FounderTrail. Check your connection and try again.");
    }
    setBusy(false);
  }

  return <div className="launch-scheduler">
    <div className="form-field">
      <label htmlFor="launch-week">Launch week</label>
      <select id="launch-week" value={weekStartsAt} onChange={(event) => { setWeekStartsAt(event.target.value); setError(""); }} aria-describedby="launch-week-help">
        {weeks.map((week) => <option key={week.value} value={week.value}>{week.label}</option>)}
      </select>
      <small id="launch-week-help" className="field-help">Weeks run Monday 00:00 UTC to the following Monday 00:00 UTC. Joining this week gives fewer than seven full days.</small>
    </div>
    <div className="settings-actions">
      <button className="button button-primary" disabled={busy} onClick={() => void schedule()}>{busy ? "Scheduling…" : "Schedule first launch"}</button>
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
  </div>;
}
