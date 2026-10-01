"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LaunchChoice } from "./LaunchChoice";
import { launchWeek, localLaunchInstant, parseLaunchChoice, type LaunchChoice as Choice } from "@/lib/launch-policy";
// Retained for older consumers of the week label helper.
export function launchWeeks(now: Date) {
  const week = launchWeek(now);
  return Array.from({ length: 26 }, (_, index) => {
    const start = new Date(week.startsAt.getTime() + index * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    const format = (date: Date) => date.toLocaleDateString("en", { timeZone: "UTC", month: "short", day: "numeric" });
    const label = `${format(start)} – ${format(end)}, ${start.getUTCFullYear()}`;
    return { value: start.toISOString(), label: index === 0 ? `This week (${label})` : label };
  });
}
export function LaunchScheduler({ slug, scheduled = false, initialChoice = "now", initialDate = "", publishDraft = false }: { slug: string; scheduled?: boolean; initialChoice?: Choice; initialDate?: string; publishDraft?: boolean }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(initialChoice);
  const [localDate, setDate] = useState(initialDate);
  useEffect(() => {
    if (initialDate && /Z$/.test(initialDate)) {
      const d=new Date(initialDate);const local=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      queueMicrotask(()=>setDate(local));
    }
  },[initialDate]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(cancel = false) {
    setBusy(true); setError("");
    try {
      const startsAt = localLaunchInstant(localDate)?.toISOString() ?? "";
      parseLaunchChoice(cancel ? "none" : choice, startsAt);
      const response = await fetch(`/api/owner/products/${encodeURIComponent(slug)}${publishDraft ? "" : "/launch"}`, { method: publishDraft ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "publish_draft", choice: cancel ? "none" : choice, startsAt, reschedule: scheduled }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your launch.");
      router.push(`/manage/${encodeURIComponent(slug)}/launch`); router.refresh(); setBusy(false);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Check your connection and try again."); setBusy(false); }
  }
  return <div className="launch-scheduler"><LaunchChoice choice={choice} onChange={setChoice} localDate={localDate} onDateChange={setDate} showNone={publishDraft} /><div className="button-row"><button type="button" className="button button-primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : publishDraft ? choice === "now" ? "Publish & launch now" : choice === "scheduled" ? "Publish & schedule launch" : "Publish startup" : scheduled ? "Save launch changes" : choice === "now" ? "Launch now" : "Schedule launch"}</button>{scheduled ? <button type="button" className="text-button" disabled={busy} onClick={() => void save(true)}>Cancel scheduled launch</button> : null}</div>{error ? <p className="form-error" role="alert">{error}</p> : null}</div>;
}
