"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProductLogo } from "./ProductLogo";
import type { ActiveSponsor } from "@/lib/foundertrail-data";

/** Server-trusted placements. Must stay in step with the sponsor_events CHECK constraint. */
export type SponsorPlacement =
  | "this_week_desktop" | "this_week_mobile" | "discover_desktop" | "discover_mobile"
  | "home_featured" | "discover_inline" | "product_detail";

/**
 * Counts one impression per booking per page view, and only for a placement that was
 * really seen: at least half visible, for a continuous second, in a visible tab. The
 * page-view id is shared with the outbound click so a click can never be counted
 * without a matching impression.
 */
function useSponsorImpression(bookingId: string, placement: SponsorPlacement) {
  const ref = useRef<HTMLElement>(null);
  const [pageViewId, setPageViewId] = useState("");
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const id = crypto.randomUUID();
    setPageViewId(id);
    let timer: number | undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.5 && document.visibilityState === "visible";
      if (visible && timer === undefined) {
        timer = window.setTimeout(() => {
          timer = undefined;
          void fetch(`/api/sponsors/${bookingId}/events`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pageViewId: id, eventType: "impression", placement }),
          }).catch(() => {});
        }, 1000);
      } else if (!visible && timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    }, { threshold: [0.5] });
    observer.observe(node);
    const onVisibility = () => {
      if (document.visibilityState !== "visible" && timer !== undefined) { clearTimeout(timer); timer = undefined; }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [bookingId, placement]);
  return { ref, pageViewId };
}

function outboundHref(bookingId: string, placement: SponsorPlacement, pageViewId: string): string {
  return `/sponsor/${bookingId}/go?source=${placement}${pageViewId ? `&pageViewId=${pageViewId}` : ""}`;
}

/** The paid link is always rel="sponsored"; FounderTrail does not sell followed links. */
const PAID_REL = "sponsored noopener noreferrer";

export function SponsorCard({ sponsor, placement }: { sponsor: ActiveSponsor; placement: SponsorPlacement }) {
  const { ref, pageViewId } = useSponsorImpression(sponsor.id, placement);
  return (
    <article ref={ref} className="sponsor-card">
      <span className="sponsor-label">Promoted</span>
      <ProductLogo productName={sponsor.name} imageUrl={sponsor.logoUrl} productUrl={null} className="product-list-logo" />
      <h3>{sponsor.name}</h3>
      <p>{sponsor.tagline}</p>
      {sponsor.category ? <small className="sponsor-category">{sponsor.category}</small> : null}
      <a className="button button-primary" href={outboundHref(sponsor.id, placement, pageViewId)} target="_blank" rel={PAID_REL}>Visit website ↗</a>
      <Link className="text-link" href={`/product/${sponsor.slug}`}>View profile</Link>
    </article>
  );
}

/**
 * The inline directory variant. It deliberately has no rank number: it is spliced into
 * the rendered list after an organic row and never takes part in the numbering.
 */
export function SponsorRow({ sponsor, placement }: { sponsor: ActiveSponsor; placement: SponsorPlacement }) {
  const { ref, pageViewId } = useSponsorImpression(sponsor.id, placement);
  return (
    <article ref={ref} className="startup-row sponsor-row">
      <div className="sponsor-row-rank" aria-hidden="true" />
      <ProductLogo productName={sponsor.name} imageUrl={sponsor.logoUrl} productUrl={null} className="product-list-logo" />
      <div className="sponsor-row-body">
        <h3><Link href={`/product/${sponsor.slug}`}>{sponsor.name}</Link></h3>
        <p>{sponsor.tagline}</p>
        <div className="sponsor-row-meta">
          <span className="sponsor-label">Promoted</span>
          {sponsor.category ? <span className="status-pill">{sponsor.category}</span> : null}
        </div>
      </div>
      <a className="button button-secondary" href={outboundHref(sponsor.id, placement, pageViewId)} target="_blank" rel={PAID_REL}>Visit website ↗</a>
    </article>
  );
}
