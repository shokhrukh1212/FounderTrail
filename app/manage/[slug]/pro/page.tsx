import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ProductLogo } from "@/components/ProductLogo";
import { ProCheckout } from "@/components/ProCheckout";
import { currentUserFromHeaders } from "@/lib/auth";
import { isProLaunchConfigured } from "@/lib/config";
import { query } from "@/lib/db";
import { getProAvailability } from "@/lib/pro-launch";
import { displayProductName } from "@/lib/display-text";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Upgrade to Pro", robots: { index: false, follow: false } };

export default async function ProPage({ params, searchParams }: PageProps<"/manage/[slug]/pro"> & { searchParams: Promise<{ order?: string }> }) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(`/manage/${slug}/pro`)}`);
  const rows = await query<{ id: string; name: string; short_name: string | null; tagline: string; website_url: string; status: string; logo_url: string | null; entitlement_status: string | null }>(
    `SELECT p.id::text,p.name,p.short_name,p.tagline,p.website_url,p.status,
      (SELECT public_url FROM product_media WHERE product_id=p.id AND kind='logo' LIMIT 1) AS logo_url,
      e.status AS entitlement_status
     FROM products p LEFT JOIN pro_entitlements e ON e.product_id=p.id
     WHERE p.slug=$1 AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2)`,
    [slug, user.id],
  );
  const product = rows[0];
  if (!product) notFound();
  if (product.entitlement_status === "active" && !search.order) redirect(`/manage/${slug}?tab=launch-kit`);
  const name = displayProductName(product.name, product.short_name);
  const availability = await getProAvailability();
  const orderId = typeof search.order === "string" && /^[0-9a-f-]{36}$/i.test(search.order) ? search.order : null;
  return <main className="app-shell inner-page pro-upgrade-page">
    <header className="page-heading"><p className="eyebrow">FounderTrail Pro</p><h1>Give {name} a polished launch kit.</h1><p>One purchase upgrades this startup. Its listing, history, organic position, and normal launch eligibility stay exactly where they are.</p></header>
    <div className="pro-upgrade-grid"><section className="settings-card pro-startup-card"><ProductLogo productName={name} productUrl={product.website_url} imageUrl={product.logo_url} className="product-detail-logo" /><div><h2>{name}</h2><p>{product.tagline}</p><span className={`status-pill status-${product.status}`}>{product.status}</span></div></section>
      {product.status !== "published" ? <section className="manager-notice"><h2>Approval required before purchase</h2><p>Finish review first. FounderTrail will not charge a pending, rejected, or private startup.</p></section> : <ProCheckout slug={slug} name={name} initialPriceMinor={availability.currentPriceMinor} introAvailable={availability.available} orderId={orderId} configured={isProLaunchConfigured()} />}
    </div>
  </main>;
}
