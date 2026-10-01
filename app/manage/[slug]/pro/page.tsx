import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ProductLogo } from "@/components/ProductLogo";
import { ProCheckout } from "@/components/ProCheckout";
import { currentUserFromHeaders } from "@/lib/auth";
import { config, isProLaunchConfigured } from "@/lib/config";
import { authenticateOwner } from "@/lib/owner-auth";
import { query } from "@/lib/db";
import { getProAvailability } from "@/lib/pro-launch";
import { displayProductName } from "@/lib/display-text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Upgrade to Pro", robots: { index: false, follow: false } };

export default async function ProPage({ params, searchParams }: PageProps<"/manage/[slug]/pro"> & { searchParams: Promise<{ order?: string }> }) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const requestHeaders = await headers();
  const user = await currentUserFromHeaders(requestHeaders).catch(() => null);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(`/manage/${slug}/pro`)}`);
  const access = await authenticateOwner(new Request(config.siteUrl, {headers:requestHeaders}), slug);
  if (!access) redirect(`/activate/${slug}`);
  const rows = await query<{ id: string; name: string; short_name: string | null; tagline: string; website_url: string; status: string; logo_url: string | null; entitlement_status: string | null; ever_rejected: boolean }>(
    `SELECT p.id::text,p.name,p.short_name,p.tagline,p.website_url,p.status,
      (SELECT public_url FROM product_media WHERE product_id=p.id AND kind='logo' LIMIT 1) AS logo_url,
      e.status AS entitlement_status,
      EXISTS(SELECT 1 FROM product_moderation_events me WHERE me.product_id=p.id AND me.to_status='rejected') AS ever_rejected
     FROM products p LEFT JOIN pro_entitlements e ON e.product_id=p.id
     WHERE p.id=$1::uuid`,
    [access.productId],
  );
  const product = rows[0];
  if (!product) notFound();
  if (product.entitlement_status === "active" && !search.order) redirect(`/manage/${slug}?tab=launch-kit`);
  const name = displayProductName(product.name, product.short_name);
  const availability = await getProAvailability();
  const latest = await query<{ id: string }>(`SELECT id::text FROM pro_launch_orders WHERE product_id=$1::uuid AND status IN ('held','checkout_created','processing','refund_pending') ORDER BY created_at DESC LIMIT 1`, [product.id]);
  const orderId = typeof search.order === "string" && /^[0-9a-f-]{36}$/i.test(search.order) ? search.order : latest[0]?.id ?? null;
  return <main className="app-shell inner-page pro-upgrade-page">
    <header className="page-heading"><p className="eyebrow">FounderTrail Pro</p><h1>Give {name} a polished launch kit.</h1><p>One purchase upgrades this startup. Its listing, history, organic position, and normal launch eligibility stay exactly where they are.</p></header>
    <div className="pro-upgrade-grid"><section className="settings-card pro-startup-card"><ProductLogo productName={name} productUrl={product.website_url} imageUrl={product.logo_url} className="product-detail-logo" /><div><h2>{name}</h2><p>{product.tagline}</p><span className={`status-pill status-${product.status}`}>{product.status}</span></div></section>
      {(!["published", "pending"].includes(product.status) || (product.status === "pending" && product.ever_rejected)) && !orderId ? <section className="manager-notice"><h2>Pro purchase unavailable</h2><p>Rejected submissions cannot start another checkout. Your free submission and its review flow remain available.</p></section> : <ProCheckout slug={slug} name={name} initialPriceMinor={availability.currentPriceMinor} introAvailable={availability.available} orderId={orderId} configured={isProLaunchConfigured() && (product.status === "published" || (product.status === "pending" && !product.ever_rejected))} submission={product.status !== "published"} />}
    </div>
  </main>;
}
