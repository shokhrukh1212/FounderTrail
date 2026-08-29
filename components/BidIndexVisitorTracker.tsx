"use client";
import { usePathname,useSearchParams } from "next/navigation";
import { useEffect,useRef } from "react";
export function BidIndexVisitorTracker(){const pathname=usePathname();const search=useSearchParams();const key=`${pathname}?${search}`;const sent=useRef("");useEffect(()=>{if(sent.current===key||/^\/(?:admin|manage|api|share|email-preferences)(?:\/|$)/.test(pathname))return;sent.current=key;const match=pathname.match(/^\/product\/([^/]+)$/);fetch("/api/visitors",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({path:pathname,productSlug:match?decodeURIComponent(match[1]):null,ref:search.get("ref")}),keepalive:true}).catch(()=>{})},[key,pathname,search]);return null}
