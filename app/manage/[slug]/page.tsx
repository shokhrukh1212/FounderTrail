import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OwnerAccess } from "@/components/OwnerAccess";
import { OwnerDashboard } from "@/components/OwnerDashboard";
import { ownerCookieName } from "@/lib/bidindex-owner";
import { ownerCredentialMatches } from "@/lib/owner-auth";
import { query } from "@/lib/db";
import { config } from "@/lib/config";
import { getManagedProduct } from "@/lib/product-data";

export const dynamic = "force-dynamic";
export default async function ManagePage({ params, searchParams }: PageProps<"/manage/[slug]"> & { searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]); const product = await getManagedProduct(slug); if (!product) notFound();
  const token = (await cookies()).get(ownerCookieName(product.id))?.value ?? null;
  if (!ownerCredentialMatches({ productId: product.id, tokenHash: product.ownerTokenHash, tokenVersion: product.ownerTokenVersion, approvedAt: product.approvedAt }, token)) return <main className="app-shell inner-page"><OwnerAccess slug={slug} /></main>;
  const [clicks,evidence,integrations] = await Promise.all([query<{ count: string }>(`SELECT count(*)::text AS count FROM product_outbound_click_events WHERE product_id=$1::uuid AND outcome='counted'`, [product.id]),query<{id:string;metric_type:string;evidence_url:string;note:string|null;status:string}>(`SELECT id::text,metric_type,evidence_url,note,status FROM product_public_evidence WHERE product_id=$1::uuid ORDER BY submitted_at DESC`,[product.id]),query<{public_id:string;allowed_domain:string;verification_token:string;domain_status:string;domain_verified_at:Date|null;domain_last_checked_at:Date|null;domain_check_outcome:string|null;verification_method:"meta"|"file";badge_status:string;badge_installed_at:Date|null;badge_last_checked_at:Date|null;badge_last_seen_at:Date|null;last_visitor_event_at:Date|null;product_verified_at:Date|null;last_event_at:Date|null;has_secret:boolean}>(`SELECT public_id::text,allowed_domain,verification_token,domain_status,domain_verified_at,domain_last_checked_at,domain_check_outcome,verification_method,badge_status,badge_installed_at,badge_last_checked_at,badge_last_seen_at,last_visitor_event_at,product_verified_at,last_event_at,(secret_hash IS NOT NULL) AS has_secret FROM product_integrations WHERE product_id=$1::uuid`,[product.id])]);
  const { ownerTokenHash: _, ownerTokenVersion: __, ...safeProduct } = product; void _; void __;
  const integration=integrations[0];const initial=integration?{publicId:integration.public_id,allowedDomain:integration.allowed_domain,verificationToken:integration.verification_token,domainStatus:integration.domain_status,domainVerifiedAt:integration.domain_verified_at?.toISOString()??null,domainLastCheckedAt:integration.domain_last_checked_at?.toISOString()??null,domainCheckOutcome:integration.domain_check_outcome,verificationMethod:integration.verification_method,badgeStatus:integration.badge_status,badgeInstalledAt:integration.badge_installed_at?.toISOString()??null,badgeLastCheckedAt:integration.badge_last_checked_at?.toISOString()??null,badgeLastSeenAt:integration.badge_last_seen_at?.toISOString()??null,lastVisitorEventAt:integration.last_visitor_event_at?.toISOString()??null,productVerifiedAt:integration.product_verified_at?.toISOString()??null,lastEventAt:integration.last_event_at?.toISOString()??null,hasSecret:integration.has_secret}:null;
  const initialTab=queryParams.tab==="updates"?"updates":queryParams.tab==="verification"?"verification":"product";
  return <main className="app-shell inner-page manage-page"><OwnerDashboard product={safeProduct} outboundClicks={Number(clicks[0]?.count ?? 0)} evidence={evidence.map(item=>({id:item.id,metricType:item.metric_type,url:item.evidence_url,note:item.note,status:item.status}))} integration={initial} siteUrl={config.siteUrl} initialTab={initialTab}/></main>;
}
