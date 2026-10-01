"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
export function ManagementAccess({slug, token, hasContact}: {slug:string;token?:string;hasContact:boolean}) {
  const [accessToken, setAccessToken] = useState(token);
  useEffect(()=>{try{const saved=sessionStorage.getItem(`foundertrail-access:/activate/${slug}`);if(saved)queueMicrotask(()=>setAccessToken(saved));}catch{}},[slug]);
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  async function access(restart = false) {
    setBusy(true); setMessage("");
    if(restart){setAccessToken(undefined);try{sessionStorage.removeItem(`foundertrail-access:/activate/${slug}`);}catch{}}
    try {
      const response=await fetch(`/api/products/${encodeURIComponent(slug)}/access`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:restart ? undefined : accessToken})});
      const result=await response.json();
      if(result.workspace){try{sessionStorage.removeItem(`foundertrail-access:/activate/${slug}`);}catch{}location.assign(result.workspace);return;}
      setMessage(result.message || result.error || "Please try again.");
    }catch{setMessage("Check your connection and try again.");}finally{setBusy(false);}
  }
  return <section className="settings-card"><h2>{accessToken ? "Confirm management access" : "Manage this startup"}</h2><p>{accessToken ? "Confirm to attach this existing listing to your signed-in account." : "We’ll check the original submission and your verified account. If needed, a one-time link goes to the original private contact."}</p><div className="button-row"><button className="button button-primary" disabled={busy} onClick={()=>void access()}>{busy?"Checking…":accessToken?"Confirm access":hasContact?"Continue securely":"Check account access"}</button>{accessToken ? <button className="button button-secondary" disabled={busy} onClick={()=>void access(true)}>Request a new link</button> : null}</div><p role="status">{message}</p><p className="field-help">Can’t access the original contact, or need a transfer? <Link href={`/claim/${slug}`}>Use domain proof or request support</Link>.</p></section>;
}
