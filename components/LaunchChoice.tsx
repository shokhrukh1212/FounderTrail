"use client";
import { useEffect, useState } from "react";
import { launchWeek, localLaunchInstant, type LaunchChoice as Choice } from "@/lib/launch-policy";
export function LaunchChoice({ choice, onChange, localDate, onDateChange, showNone = true }: { choice: Choice; onChange: (value: Choice) => void; localDate: string; onDateChange: (value: string) => void; showNone?: boolean }) {
  const [zone, setZone] = useState("your local timezone");
  const [weekEnd, setWeekEnd] = useState("");
  useEffect(() => { queueMicrotask(() => { setZone(Intl.DateTimeFormat().resolvedOptions().timeZone); setWeekEnd(launchWeek(new Date()).endsAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })); }); }, []);
  const date = localLaunchInstant(localDate);
  const week = date ? launchWeek(date) : null;
  function chooseNextWeek() {
    const next = launchWeek(new Date()).endsAt;
    next.setHours(9, 0, 0, 0);
    onDateChange(`${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}T09:00`);
    onChange("scheduled");
  }
  return <div className="launch-choice-group" role="group" aria-label="When would you like to launch?">
    <div className="launch-choice-heading"><h3>When would you like to launch?</h3><span>Always free</span></div>
    {([{ value: "now", title: "Launch now", description: "Publish your page and join this week’s launches immediately." }, { value: "scheduled", title: "Choose a launch date", description: "Publish your page now. Join the launch list on your chosen date." }, ...(showNone ? [{ value: "none", title: "Publish my page only", description: "Publish now and choose a launch date later." }] : [])] as const).map(item => <label key={item.value} className={`launch-choice-card ${choice === item.value ? "is-selected" : ""}`}>
      <input type="radio" name="launchChoice" value={item.value} checked={choice === item.value} onChange={() => onChange(item.value as Choice)} />
      <span><strong>{item.title}</strong><small>{item.description}</small></span>{item.value === "now" ? <span className="launch-recommended">Recommended</span> : null}
    </label>)}
    {choice === "scheduled" ? <div className="launch-date-fields"><label>Launch date<input aria-label="Launch date" type="date" value={localDate.split("T")[0] || ""} onChange={e => onDateChange(`${e.target.value}T${localDate.split("T")[1] || "09:00"}`)} /></label><label>Time<input aria-label="Launch time" type="time" value={localDate.split("T")[1] || "09:00"} onChange={e => onDateChange(`${localDate.split("T")[0] || ""}T${e.target.value}`)} /></label><p className="field-help">Timezone: {zone}. {week ? `Launch week: ${week.startsAt.toLocaleDateString("en", {timeZone:"UTC", month:"short",day:"numeric"})} – ${week.endsAt.toLocaleDateString("en", {timeZone:"UTC",month:"short",day:"numeric"})} (Monday–Monday UTC).` : "Choose a future date; the default time is 09:00."}</p></div> : null}
    {choice === "now" ? <p className="field-help">{weekEnd ? `This week’s list ends ${weekEnd} (${zone}).` : "Launch weeks end Monday at 00:00 UTC."} <button className="text-button" type="button" onClick={chooseNextWeek}>Choose next week</button></p> : null}
    {choice === "scheduled" && localDate && !date ? <p className="form-error" role="alert">Choose a valid local date and time. This time may fall in a daylight-saving clock change.</p> : null}
    <input type="hidden" name="launchStartsAt" value={choice === "scheduled" && date ? date.toISOString() : ""} />
  </div>;
}
