import "server-only";
import { query } from "./db";
import type { AdminProductDetail, AdminProductSummary } from "./admin-product-types";

type SummaryRow = {
  id: string; slug: string; name: string; website_url: string; founder_name: string | null;
  contact_email: string; founder_social_handle: string | null; status: string; product_verified_at: Date | null;
  domain_verified_at: Date | null; upvotes: number; product_views: number; referred_visitors: number;
  submitted_at: Date; approved_at: Date | null; approval_email_status: string; approval_email_sent_at: Date | null;
  logo_url: string | null;
};

export async function listAdminProducts(): Promise<AdminProductSummary[]> {
  const rows = await query<SummaryRow>(`SELECT p.id::text,p.slug,p.name,p.website_url,p.founder_name,p.contact_email,
      p.founder_social_handle,p.status,i.product_verified_at,i.domain_verified_at,
      (SELECT count(*)::int FROM product_votes v WHERE v.product_id=p.id AND v.active AND NOT v.is_demo) AS upvotes,
      (SELECT count(*)::int FROM product_listing_view_events e WHERE e.product_id=p.id AND e.outcome='counted') AS product_views,
      (SELECT count(*)::int FROM founder_referral_events e WHERE e.source_product_id=p.id AND e.outcome='counted') AS referred_visitors,
      p.submitted_at,p.approved_at,p.approval_email_status,p.approval_email_sent_at,
      (SELECT public_url FROM product_media m WHERE m.product_id=p.id AND m.kind='logo' ORDER BY m.position LIMIT 1) AS logo_url
    FROM products p LEFT JOIN product_integrations i ON i.product_id=p.id
    WHERE NOT p.is_demo ORDER BY p.submitted_at DESC,p.id`);
  return rows.map(row => ({
    id:row.id,slug:row.slug,name:row.name,websiteUrl:row.website_url,founderName:row.founder_name,
    contactEmail:row.contact_email,founderSocialHandle:row.founder_social_handle,status:row.status,
    verificationStatus:row.product_verified_at?"verified":row.domain_verified_at?"domain_verified":"not_verified",
    upvotes:Number(row.upvotes),productViews:Number(row.product_views),referredVisitors:Number(row.referred_visitors),
    submittedAt:new Date(row.submitted_at).toISOString(),approvedAt:row.approved_at?new Date(row.approved_at).toISOString():null,
    approvalEmailStatus:row.approval_email_status,approvalEmailSentAt:row.approval_email_sent_at?new Date(row.approval_email_sent_at).toISOString():null,
    logoUrl:row.logo_url,
  }));
}

export async function getAdminProductDetail(slug: string): Promise<AdminProductDetail | null> {
  const products = await query<Record<string, unknown>>(`SELECT p.id::text,p.slug,p.name,p.tagline,p.description,p.website_url,p.submitted_url,
      p.normalized_domain,p.founder_name,p.contact_email,p.founder_social_handle,p.status,p.launch_date::text,p.submitted_at,
      p.published_at,p.approved_at,p.submission_consent_at,p.submission_consent_version,p.domain_override_approved,
      p.founding_position,p.bidding_mechanism,p.minimum_bid_minor::text,p.current_bid_minor::text,p.bid_currency,
      p.public_analytics_url,p.data_disclosure,p.approval_email_status,p.approval_email_sent_at,
      p.approval_email_last_attempt_at,p.approval_email_last_failure,c.name AS category_name,
      pref.marketing_opt_in_at,pref.marketing_unsubscribed_at,
      COALESCE((SELECT array_agg(s.reason ORDER BY s.reason) FROM founder_email_suppressions s WHERE s.normalized_email=pref.normalized_email),'{}'::text[]) AS suppressions,
      i.domain_status,i.allowed_domain,i.verification_method,i.domain_verified_at,i.badge_status,i.badge_installed_at,i.product_verified_at,
      o.created_at AS owner_created_at,o.rotated_at AS owner_rotated_at,
      (SELECT count(*)::int FROM product_votes v WHERE v.product_id=p.id AND v.active AND NOT v.is_demo) AS upvotes,
      (SELECT count(*)::int FROM product_listing_view_events e WHERE e.product_id=p.id AND e.outcome='counted') AS product_views,
      (SELECT count(*)::int FROM founder_referral_events e WHERE e.source_product_id=p.id AND e.outcome='counted') AS referred_visitors,
      (SELECT count(*)::int FROM product_outbound_click_events e WHERE e.product_id=p.id AND e.outcome='counted') AS outbound_clicks
    FROM products p
    JOIN founder_email_preferences pref ON pref.id=p.email_preference_id
    LEFT JOIN categories c ON c.id=p.primary_category_id
    LEFT JOIN product_integrations i ON i.product_id=p.id
    LEFT JOIN product_owner_credentials o ON o.product_id=p.id
    WHERE p.slug=$1 AND NOT p.is_demo LIMIT 1`,[slug]);
  const p=products[0]; if(!p)return null; const id=String(p.id);
  const [metadata,media,moderation]=await Promise.all([
    query<Record<string,unknown>>(`SELECT original_url,final_url,fetch_status,extracted_name,extracted_tagline,extracted_logo_url,extracted_image_url,fetched_at FROM product_submission_metadata WHERE product_id=$1::uuid`,[id]),
    query<Record<string,unknown>>(`SELECT id::text,kind,public_url,mime_type,byte_size,width,height,alt_text,position FROM product_media WHERE product_id=$1::uuid ORDER BY CASE kind WHEN 'logo' THEN 0 ELSE 1 END,position`,[id]),
    query<Record<string,unknown>>(`SELECT from_status,to_status,internal_reason,created_at FROM product_moderation_events WHERE product_id=$1::uuid ORDER BY created_at DESC`,[id]),
  ]);
  const iso=(value:unknown)=>value?new Date(value as string|number|Date).toISOString():null;
  const numberOrNull=(value:unknown)=>value===null||value===undefined?null:Number(value);
  const m=metadata[0];
  return {
    product:{id,slug:String(p.slug),name:String(p.name),tagline:String(p.tagline),description:p.description===null?null:String(p.description),websiteUrl:String(p.website_url),submittedUrl:String(p.submitted_url),normalizedDomain:String(p.normalized_domain),founderName:p.founder_name===null?null:String(p.founder_name),contactEmail:String(p.contact_email),founderSocialHandle:p.founder_social_handle===null?null:String(p.founder_social_handle),status:String(p.status),launchDate:String(p.launch_date),submittedAt:iso(p.submitted_at)!,publishedAt:iso(p.published_at),approvedAt:iso(p.approved_at),consentAt:iso(p.submission_consent_at),consentVersion:p.submission_consent_version===null?null:String(p.submission_consent_version),category:p.category_name===null?null:String(p.category_name),domainOverrideApproved:Boolean(p.domain_override_approved),foundingPosition:numberOrNull(p.founding_position),biddingMechanism:p.bidding_mechanism===null?null:String(p.bidding_mechanism),minimumBidMinor:numberOrNull(p.minimum_bid_minor),currentBidMinor:numberOrNull(p.current_bid_minor),bidCurrency:p.bid_currency===null?null:String(p.bid_currency),publicAnalyticsUrl:p.public_analytics_url===null?null:String(p.public_analytics_url),dataDisclosure:p.data_disclosure===null?null:String(p.data_disclosure)},
    email:{marketingOptedIn:Boolean(p.marketing_opt_in_at)&&!p.marketing_unsubscribed_at,marketingUnsubscribedAt:iso(p.marketing_unsubscribed_at),suppressions:Array.isArray(p.suppressions)?p.suppressions.map(String):[],approvalStatus:String(p.approval_email_status),approvalSentAt:iso(p.approval_email_sent_at),approvalLastAttemptAt:iso(p.approval_email_last_attempt_at),approvalFailure:p.approval_email_last_failure===null?null:String(p.approval_email_last_failure)},
    verification:{domainStatus:String(p.domain_status??"not_started"),allowedDomain:p.allowed_domain===null||p.allowed_domain===undefined?null:String(p.allowed_domain),verificationMethod:p.verification_method===null||p.verification_method===undefined?null:String(p.verification_method),domainVerifiedAt:iso(p.domain_verified_at),badgeStatus:String(p.badge_status??"not_started"),badgeInstalledAt:iso(p.badge_installed_at),productVerifiedAt:iso(p.product_verified_at)},
    ownerCredential:{createdAt:iso(p.owner_created_at),rotatedAt:iso(p.owner_rotated_at)},
    metadata:m?{originalUrl:String(m.original_url),finalUrl:String(m.final_url),fetchStatus:String(m.fetch_status),extractedName:m.extracted_name===null?null:String(m.extracted_name),extractedTagline:m.extracted_tagline===null?null:String(m.extracted_tagline),extractedLogoUrl:m.extracted_logo_url===null?null:String(m.extracted_logo_url),extractedImageUrl:m.extracted_image_url===null?null:String(m.extracted_image_url),fetchedAt:iso(m.fetched_at)}:null,
    media:media.map(item=>({id:String(item.id),kind:String(item.kind),url:String(item.public_url),mimeType:String(item.mime_type),byteSize:Number(item.byte_size),width:numberOrNull(item.width),height:numberOrNull(item.height),altText:item.alt_text===null?null:String(item.alt_text),position:Number(item.position)})),
    moderation:moderation.map(item=>({fromStatus:String(item.from_status),toStatus:String(item.to_status),reason:item.internal_reason===null?null:String(item.internal_reason),createdAt:iso(item.created_at)!})),
    metrics:{upvotes:Number(p.upvotes),productViews:Number(p.product_views),referredVisitors:Number(p.referred_visitors),outboundClicks:Number(p.outbound_clicks)},
  };
}
