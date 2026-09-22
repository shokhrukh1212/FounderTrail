"use client";
import { useEffect,useRef,useState } from "react";
type State={valid:boolean;optedIn:boolean;unsubscribed:boolean;suppressed:boolean};
export function EmailPreferences(){
  const token=useRef("");
  const [state,setState]=useState<State|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  useEffect(()=>{void (async()=>{
    const raw=location.hash.match(/^#token=(.+)$/)?.[1]??sessionStorage.getItem("bidindex-email-preference")??"";
    let value="";try{value=decodeURIComponent(raw)}catch{}
    if(!value){setError("Open the private preference link from your email.");return}
    token.current=value;sessionStorage.setItem("bidindex-email-preference",value);history.replaceState(null,"",location.pathname);
    try{const response=await fetch("/api/email-preferences",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:value,action:"read"})});if(!response.ok)throw new Error();setState(await response.json() as State)}catch{setError("This preference link is invalid or expired.")}
  })()},[]);
  async function unsubscribe(){setBusy(true);setError("");const response=await fetch("/api/email-preferences",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:token.current,action:"unsubscribe"})});if(response.ok)setState({valid:true,optedIn:false,unsubscribed:true,suppressed:true});else setError("Could not update your preference.");setBusy(false)}
  return <section className="manager-card preference-card"><h1>Email preferences</h1>{error?<p className="form-error">{error}</p>:null}{state&&!state.unsubscribed&&!state.suppressed?<><p>You currently receive optional FounderTrail product and founder news. Transactional owner, approval and important verification messages are separate.</p><button className="button button-primary" disabled={busy} onClick={unsubscribe}>{busy?"Unsubscribing…":"Unsubscribe from founder updates"}</button></>:null}{state&&(state.unsubscribed||state.suppressed)?<><p className="manager-notice is-success">You are permanently unsubscribed from FounderTrail promotional campaigns.</p><p>Transactional owner, approval and important verification messages may still be sent when needed.</p></>:null}</section>
}
