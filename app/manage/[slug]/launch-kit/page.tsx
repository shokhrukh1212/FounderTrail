import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LaunchStudio, type LaunchImageSource } from "@/components/LaunchStudio";
import { currentUserFromHeaders } from "@/lib/auth";
import { config } from "@/lib/config";
import { query } from "@/lib/db";
import { defaultLaunchKitDraft, normalizeLaunchKitDraft, type LaunchFacts } from "@/lib/launch-kit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Launch kit", robots: { index: false, follow: false } };

export default async function LaunchKitPage({ params }: PageProps<"/manage/[slug]/launch-kit">) {
  const { slug } = await params;
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(`/manage/${slug}/launch-kit`)}`);
  const products = await query<{
    id: string; name: string; tagline: string; use_case: string | null; intended_audience: string | null;
    website_url: string; entitlement_status: "active" | "suspended" | "revoked" | null; launch_state: string | null;
  }>(
    `SELECT p.id::text,p.name,p.tagline,p.use_case,p.intended_audience,p.website_url,e.status AS entitlement_status,
      (SELECT CASE WHEN lw.starts_at>now() THEN 'upcoming' WHEN now()<lw.ends_at THEN 'live' ELSE 'listed' END
       FROM product_launches pl JOIN launch_weeks lw ON lw.id=pl.launch_week_id
       WHERE pl.product_id=p.id AND pl.state IN ('scheduled','active','completed') ORDER BY lw.starts_at DESC LIMIT 1) AS launch_state
     FROM products p LEFT JOIN pro_entitlements e ON e.product_id=p.id
     WHERE p.slug=$1 AND (EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2)
       OR EXISTS(SELECT 1 FROM app_users au WHERE au.id=$2 AND au.role='admin'))`, [slug, user.id],
  );
  const product = products[0];
  if (!product) notFound();
  const facts: LaunchFacts = { name: product.name, tagline: product.tagline, useCase: product.use_case, audience: product.intended_audience, websiteUrl: product.website_url, founderTrailUrl: `${config.siteUrl}/product/${slug}`, launchState: product.launch_state === "upcoming" || product.launch_state === "live" ? product.launch_state : "listed" };
  const [draftRows, media, assets] = await Promise.all([
    query<{ version: number; image_draft: Record<string, unknown>; social_draft: Record<string, unknown> }>(`SELECT version,image_draft,social_draft FROM pro_launch_kit_drafts WHERE product_id=$1::uuid`, [product.id]),
    query<{ id: string; kind: "logo" | "screenshot"; position: number }>(`SELECT id::text,kind,position FROM product_media WHERE product_id=$1::uuid AND kind IN ('logo','screenshot') ORDER BY kind,position`, [product.id]),
    query<{ id: string; kind: "logo" | "screenshot" }>(`SELECT id::text,kind FROM pro_launch_kit_assets WHERE product_id=$1::uuid ORDER BY created_at`, [product.id]),
  ]);
  const sources: LaunchImageSource[] = [
    ...media.map((item) => ({ source: `media:${item.id}`, url: `/api/owner/products/${encodeURIComponent(slug)}/launch-kit/media/${item.id}`, label: item.kind === "logo" ? "Approved listing logo" : `Approved screenshot ${item.position + 1}`, kind: item.kind })),
    ...assets.map((item, index) => ({ source: `asset:${item.id}`, url: `/api/owner/products/${encodeURIComponent(slug)}/launch-kit/assets/${item.id}`, label: `Private ${item.kind} ${index + 1}`, kind: item.kind })),
  ];
  const firstLogo = sources.find((item) => item.kind === "logo")?.source ?? "";
  const firstScreenshot = sources.find((item) => item.kind === "screenshot")?.source ?? "";
  const base = defaultLaunchKitDraft(facts, firstLogo, firstScreenshot);
  const stored = draftRows[0];
  const draft = stored ? normalizeLaunchKitDraft({ image: stored.image_draft, social: stored.social_draft }, facts, base) : base;
  const active = product.entitlement_status === "active";
  return <main className="app-shell inner-page launch-kit-page">
    <header className="page-heading"><p className="eyebrow">Launch kit</p><h1>Create launch assets for {product.name}</h1><p>Two intentional layouts, two useful formats, and editable post drafts. Nothing is posted automatically.</p><nav className="owner-page-nav"><Link href={`/manage/${slug}`}>Overview</Link><Link aria-current="page" href={`/manage/${slug}/launch-kit`}>Launch kit</Link><Link href={`/manage/${slug}/results`}>Results</Link></nav></header>
    {!active ? <section className="upgrade-preview-notice"><div><h2>{product.entitlement_status === "suspended" ? "Pro access is temporarily suspended" : product.entitlement_status === "revoked" ? "Pro access was revoked" : "Preview the real launch studio"}</h2><p>{product.entitlement_status ? "Your free listing and its history remain available. Contact support if this payment state looks wrong." : "This is the production editor in read-only mode. Upgrade this startup to save drafts and download assets."}</p></div>{!product.entitlement_status ? <Link className="button button-primary" href={`/manage/${slug}/pro`}>Upgrade to Pro</Link> : null}</section> : null}
    <LaunchStudio slug={slug} facts={facts} initialDraft={draft} initialVersion={stored?.version ?? 0} sources={sources} canEdit={active} />
  </main>;
}
