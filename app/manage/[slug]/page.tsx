import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { OwnerAccess } from "@/components/OwnerAccess";
import { OwnerDashboard } from "@/components/OwnerDashboard";
import { isOwnerTab, type OwnerTab } from "@/lib/owner-tabs";
import { LaunchKitPanel } from "@/components/LaunchKitPanel";
import { ProResultsPanel } from "@/components/ProResultsPanel";
import { query } from "@/lib/db";
import { config } from "@/lib/config";
import { getManagedProduct } from "@/lib/product-data";
import { currentUserFromHeaders } from "@/lib/auth";
import { authenticateOwner } from "@/lib/owner-auth";

export const dynamic = "force-dynamic";
export default async function ManagePage({ params, searchParams }: PageProps<"/manage/[slug]"> & { searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]); const product = await getManagedProduct(slug); if (!product) notFound();
  const requestHeaders = await headers();
  const user = await currentUserFromHeaders(requestHeaders).catch(() => null);
  const access = user ? await authenticateOwner(new Request(config.siteUrl, { headers: requestHeaders }), slug) : null;
  const accountOwner = access && user ? (await query<{ allowed: boolean }>(`SELECT EXISTS(SELECT 1 FROM product_owners WHERE product_id=$1::uuid AND user_id=$2) AS allowed`, [product.id, user.id]))[0]?.allowed : false;
  // Admins can open every product's workspace; a banner says they are not its owner.
  const adminView = !accountOwner && user?.role === "admin";
  if (!accountOwner && !adminView) return <main className="app-shell inner-page"><OwnerAccess slug={slug} /></main>;
  const [clicks,evidence,integrations,growthRows,workspaceUpdates,review,proRows] = await Promise.all([query<{ count: string }>(`SELECT count(*)::text AS count FROM product_outbound_click_events WHERE product_id=$1::uuid AND outcome='counted'`, [product.id]),query<{id:string;metric_type:string;evidence_url:string;note:string|null;status:string}>(`SELECT id::text,metric_type,evidence_url,note,status FROM product_public_evidence WHERE product_id=$1::uuid ORDER BY submitted_at DESC`,[product.id]),query<{public_id:string;allowed_domain:string;verification_token:string;domain_status:string;domain_verified_at:Date|null;domain_last_checked_at:Date|null;domain_check_outcome:string|null;verification_method:"meta"|"file";badge_status:string;badge_installed_at:Date|null;badge_last_checked_at:Date|null;badge_last_seen_at:Date|null;last_visitor_event_at:Date|null;product_verified_at:Date|null;last_event_at:Date|null;has_secret:boolean}>(`SELECT public_id::text,allowed_domain,verification_token,domain_status,domain_verified_at,domain_last_checked_at,domain_check_outcome,verification_method,badge_status,badge_installed_at,badge_last_checked_at,badge_last_seen_at,last_visitor_event_at,product_verified_at,last_event_at,(secret_hash IS NOT NULL) AS has_secret FROM product_integrations WHERE product_id=$1::uuid`,[product.id]),query<{listing_views:number;outbound_clicks:number;followers:number;comments:number;launch_votes:number}>(`SELECT
    (SELECT count(*)::int FROM product_listing_view_events WHERE product_id=$1::uuid AND outcome='counted') AS listing_views,
    (SELECT count(*)::int FROM product_outbound_click_events WHERE product_id=$1::uuid AND outcome='counted') AS outbound_clicks,
    (SELECT count(*)::int FROM product_follows WHERE product_id=$1::uuid) AS followers,
    (SELECT count(*)::int FROM product_comments WHERE product_id=$1::uuid AND hidden_at IS NULL) AS comments,
    (SELECT count(*)::int FROM launch_votes lv JOIN product_launches pl ON pl.id=lv.launch_id WHERE pl.product_id=$1::uuid AND lv.active) AS launch_votes`,[product.id]),query<{id:string;type:string;title:string;body:string;link_url:string|null;status:"draft"|"published"|"archived";published_at:Date|null;updated_at:Date}>(`SELECT id::text,type,title,body,link_url,status,published_at,updated_at FROM product_updates WHERE product_id=$1::uuid ORDER BY updated_at DESC,id DESC`,[product.id]),query<{internal_reason:string|null}>(`SELECT internal_reason FROM product_moderation_events WHERE product_id=$1::uuid AND to_status='rejected' ORDER BY created_at DESC LIMIT 1`,[product.id]),query<{status:string}>(`SELECT status FROM pro_entitlements WHERE product_id=$1::uuid`,[product.id])]);
  const { ownerTokenHash: _, ownerTokenVersion: __, ...safeProduct } = product; void _; void __;
  const integration=integrations[0];const initial=integration?{publicId:integration.public_id,allowedDomain:integration.allowed_domain,verificationToken:integration.verification_token,domainStatus:integration.domain_status,domainVerifiedAt:integration.domain_verified_at?.toISOString()??null,domainLastCheckedAt:integration.domain_last_checked_at?.toISOString()??null,domainCheckOutcome:integration.domain_check_outcome,verificationMethod:integration.verification_method,badgeStatus:integration.badge_status,badgeInstalledAt:integration.badge_installed_at?.toISOString()??null,badgeLastCheckedAt:integration.badge_last_checked_at?.toISOString()??null,badgeLastSeenAt:integration.badge_last_seen_at?.toISOString()??null,lastVisitorEventAt:integration.last_visitor_event_at?.toISOString()??null,productVerifiedAt:integration.product_verified_at?.toISOString()??null,lastEventAt:integration.last_event_at?.toISOString()??null,hasSecret:integration.has_secret}:null;
  // Older links used ?tab=product; everything else maps one-to-one onto the tab row.
  const tab: OwnerTab = isOwnerTab(queryParams.tab) ? queryParams.tab : "overview";
  const proStatus = proRows[0]?.status ?? null;
  const panel = tab === "launch-kit" ? <LaunchKitPanel slug={slug} productId={product.id} entitlementStatus={proStatus} />
    : tab === "results" ? <ProResultsPanel slug={slug} productId={product.id} entitlementStatus={proStatus} />
    : null;
  const growth=growthRows[0]??{listing_views:0,outbound_clicks:0,followers:0,comments:0,launch_votes:0};
  return <main className="app-shell inner-page manage-page">{adminView ? <section className="manager-notice admin-view-notice print-hide"><h2>Admin view</h2><p>You are not an owner of this startup. You see its workspace as its founder does, and any change you save here applies to the founder&apos;s real listing and launch kit.</p></section> : null}<OwnerDashboard product={safeProduct} workspaceUpdates={workspaceUpdates.map(item=>({id:item.id,type:item.type,title:item.title,body:item.body,linkUrl:item.link_url,status:item.status,publishedAt:item.published_at?.toISOString()??null,updatedAt:item.updated_at.toISOString()}))} outboundClicks={Number(clicks[0]?.count ?? 0)} growth={{listingViews:growth.listing_views,outboundClicks:growth.outbound_clicks,followers:growth.followers,comments:growth.comments,launchVotes:growth.launch_votes}} evidence={evidence.map(item=>({id:item.id,metricType:item.metric_type,url:item.evidence_url,note:item.note,status:item.status}))} integration={initial} siteUrl={config.siteUrl} initialReviewReason={review[0]?.internal_reason??null} proStatus={proStatus} tab={tab}>{panel}</OwnerDashboard></main>;
}
