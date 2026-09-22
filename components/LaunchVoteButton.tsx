"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LaunchVoteButton({ launchId, initialCount, initialActive }: { launchId: string; initialCount: number; initialActive: boolean }) {
  const router=useRouter();
  const [count,setCount]=useState(initialCount); const [active,setActive]=useState(initialActive); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function toggle(){if(busy)return;setBusy(true);setError("");const response=await fetch(`/api/launches/${encodeURIComponent(launchId)}/vote`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({active:!active})});if(response.status===401){router.push(`/sign-in?returnTo=${encodeURIComponent(location.pathname+location.search)}`);return;}const result=await response.json() as {active?:boolean;count?:number;error?:string};if(response.ok&&typeof result.active==="boolean"&&typeof result.count==="number"){setActive(result.active);setCount(result.count)}else setError(result.error??"Vote failed");setBusy(false)}
  return <button type="button" className={`vote-button${active?" is-active":""}`} aria-pressed={active} disabled={busy} onClick={()=>void toggle()} title={error||"Vote in this launch"}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 4 5.5 7H12v5H8v-5H4.5L10 4Z" /></svg><span>{count}</span></button>;
}
