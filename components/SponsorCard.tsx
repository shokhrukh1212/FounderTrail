"use client";

import { useEffect, useRef, useState } from "react";
import { ProductLogo } from "./ProductLogo";
import type { ActiveSponsor, FounderTrailView } from "@/lib/foundertrail-data";

export function SponsorCard({ sponsor, view }: { sponsor: ActiveSponsor; view: Exclude<FounderTrailView, "updates"> }) {
  const ref = useRef<HTMLElement>(null);
  const [pageViewId, setPageViewId] = useState("");
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const id = crypto.randomUUID(); setPageViewId(id);
    let timer: number | undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting && entries[0].intersectionRatio >= .5 && document.visibilityState === "visible";
      if (visible && timer === undefined) timer = window.setTimeout(() => {
        timer = undefined;
        void fetch(`/api/sponsors/${sponsor.id}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pageViewId: id, eventType: "impression", placement: `${view}_${matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop"}` }) });
      }, 1000);
      else if (!visible && timer !== undefined) { clearTimeout(timer); timer = undefined; }
    }, { threshold: [.5] });
    observer.observe(node);
    const onVisibility = () => { if (document.visibilityState !== "visible" && timer !== undefined) { clearTimeout(timer); timer = undefined; } };
    document.addEventListener("visibilitychange", onVisibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility); if (timer !== undefined) clearTimeout(timer); };
  }, [sponsor.id, view]);
  return <article ref={ref} className="sponsor-card"><span>Sponsored</span><ProductLogo productName={sponsor.name} imageUrl={sponsor.logoUrl} productUrl={null} className="product-list-logo"/><h3>{sponsor.name}</h3><p>{sponsor.tagline}</p><a className="button button-primary" href={`/sponsor/${sponsor.id}/go?source=${view}${pageViewId ? `&pageViewId=${pageViewId}` : ""}`} target="_blank" rel="noopener noreferrer">Visit website ↗</a></article>;
}
