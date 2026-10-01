import Link from "next/link";
import { LaunchStudio, type LaunchImageSource } from "@/components/LaunchStudio";
import { config } from "@/lib/config";
import { sharedProductUrl } from "@/lib/product-share";
import { displayProductName, suggestedShortName } from "@/lib/display-text";
import { query } from "@/lib/db";
import { LISTING_LOGO_SOURCE, defaultLaunchKitDraft, normalizeLaunchKitDraft, type LaunchFacts } from "@/lib/launch-kit";

/**
 * The Launch kit tab. Ownership is checked by the page that renders the workspace; this
 * only loads the studio's data. Non-Pro owners see their real graphic with every edit and
 * export control disabled, and an upgrade path next to it.
 */
export async function LaunchKitPanel({ slug, productId, entitlementStatus }: {
  slug: string;
  productId: string;
  entitlementStatus: string | null;
}) {
  const rows = await query<{
    name: string; short_name: string | null; tagline: string; use_case: string | null; intended_audience: string | null;
    website_url: string; launch_date: Date | null; launch_state: string | null;
  }>(
    `SELECT p.name,p.short_name,p.tagline,p.use_case,p.intended_audience,p.website_url,
      (SELECT starts_at FROM product_launches WHERE product_id=p.id AND state<>'cancelled' LIMIT 1) AS launch_date,
      (SELECT CASE WHEN pl.starts_at>now() THEN 'upcoming' WHEN now()<lw.ends_at THEN 'live' ELSE 'listed' END
       FROM product_launches pl JOIN launch_weeks lw ON lw.id=pl.launch_week_id
       WHERE pl.product_id=p.id AND pl.state IN ('scheduled','active','completed') ORDER BY pl.starts_at DESC LIMIT 1) AS launch_state
     FROM products p WHERE p.id=$1::uuid`, [productId],
  );
  const product = rows[0];
  if (!product) return null;
  // A new draft starts from the short brand name: long legacy names ("Brand — tagline")
  // cannot fit the layout, and an owner without Pro cannot shorten them. Saved drafts keep
  // whatever name the founder saved.
  const displayName = displayProductName(product.name, product.short_name);
  const facts: LaunchFacts = { launchDate: product.launch_date ? new Date(product.launch_date).toLocaleDateString("en",{timeZone:"UTC",dateStyle:"medium"}) + " UTC" : null, name: displayName.length > 60 ? suggestedShortName(product.name) ?? displayName : displayName, tagline: product.tagline, useCase: product.use_case, audience: product.intended_audience, websiteUrl: product.website_url, founderTrailUrl: sharedProductUrl(config.siteUrl, slug), launchState: product.launch_state === "upcoming" || product.launch_state === "live" ? product.launch_state : "listed" };
  const [draftRows, media, assets] = await Promise.all([
    query<{ version: number; image_draft: Record<string, unknown>; social_draft: Record<string, unknown> }>(`SELECT version,image_draft,social_draft FROM pro_launch_kit_drafts WHERE product_id=$1::uuid`, [productId]),
    query<{ id: string; kind: "logo" | "screenshot"; position: number }>(`SELECT id::text,kind,position FROM product_media WHERE product_id=$1::uuid AND kind IN ('logo','screenshot') ORDER BY kind,position`, [productId]),
    query<{ id: string; kind: "logo" | "screenshot" }>(`SELECT id::text,kind FROM pro_launch_kit_assets WHERE product_id=$1::uuid ORDER BY created_at`, [productId]),
  ]);
  const hasUploadedLogo = media.some((item) => item.kind === "logo");
  const sources: LaunchImageSource[] = [
    // Listings that never uploaded a logo still get the one read from their website, or
    // Google's copy of its favicon when the site links none we can use.
    ...(!hasUploadedLogo ? [{ source: LISTING_LOGO_SOURCE, url: `/api/owner/products/${encodeURIComponent(slug)}/launch-kit/media/listing-logo`, label: "Logo from your website", kind: "logo" as const }] : []),
    ...media.map((item) => ({ source: `media:${item.id}`, url: `/api/owner/products/${encodeURIComponent(slug)}/launch-kit/media/${item.id}`, label: item.kind === "logo" ? "Listing logo" : `Approved screenshot ${item.position + 1}`, kind: item.kind })),
    ...assets.map((item, index) => ({ source: `asset:${item.id}`, url: `/api/owner/products/${encodeURIComponent(slug)}/launch-kit/assets/${item.id}`, label: `Private ${item.kind} ${index + 1}`, kind: item.kind })),
  ];
  const firstLogo = sources.find((item) => item.kind === "logo")?.source ?? "";
  const firstScreenshot = sources.find((item) => item.kind === "screenshot")?.source ?? "";
  const base = defaultLaunchKitDraft(facts, firstLogo, firstScreenshot);
  const stored = draftRows[0];
  const saved = stored ? normalizeLaunchKitDraft({ image: stored.image_draft, social: stored.social_draft }, facts, base) : base;
  // A saved draft can point at an image that has since gone: the website logo gives way to
  // an uploaded one, a new upload deletes the old, a screenshot is removed. Follow what the
  // listing has now instead of leaving a hole in the graphic.
  const available = new Set(sources.map((item) => item.source));
  const current = (source: string, fallback: string) => source && !available.has(source) ? fallback : source;
  const draft = { ...saved, image: { ...saved.image, logoSource: current(saved.image.logoSource, firstLogo), screenshotSource: current(saved.image.screenshotSource, firstScreenshot) } };
  const active = entitlementStatus === "active";
  const upgradeHref = entitlementStatus ? null : `/manage/${slug}/pro`;
  return <section className="launch-kit-tab" aria-labelledby="launch-kit-heading">
    <header className="owner-tab-heading"><h2 id="launch-kit-heading">Launch kit</h2><p>Two intentional layouts, two useful formats, and editable post drafts. Nothing is posted automatically.</p></header>
    {!active ? <section className="upgrade-preview-notice"><div><h2>{entitlementStatus === "suspended" ? "Pro access is temporarily suspended" : entitlementStatus === "revoked" ? "Pro access was revoked" : "Preview the real launch studio"}</h2><p>{entitlementStatus ? "Your free listing and its history remain available. Contact support if this payment state looks wrong." : "This is your real launch graphic in read-only mode. Upgrade this startup to edit it, save drafts and download assets."}</p></div>{upgradeHref ? <Link className="button button-primary" href={upgradeHref}>Upgrade to Pro</Link> : null}</section> : null}
    <LaunchStudio slug={slug} facts={facts} initialDraft={draft} initialVersion={stored?.version ?? 0} sources={sources} canEdit={active} upgradeHref={upgradeHref} />
  </section>;
}
