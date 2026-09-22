import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ProductLogo } from "@/components/ProductLogo";
import { ProBadge } from "@/components/ProBadge";
import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My products", robots: { index: false, follow: false } };

export default async function MyProductsPage() {
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent("/my-products")}`);
  const products = await query<{ id: string; slug: string; name: string; tagline: string; website_url: string; status: string; logo_url: string | null; ownership_role: string | null; claim_state: string | null; followers: number; comments: number; entitlement_status: string | null }>(
    `SELECT p.id::text,p.slug,p.name,p.tagline,p.website_url,p.status,
            (SELECT m.public_url FROM product_media m WHERE m.product_id=p.id AND m.kind='logo' LIMIT 1) AS logo_url,
            po.ownership_role,
            (SELECT pc.state FROM product_claims pc WHERE pc.product_id=p.id AND pc.requester_id=$1 ORDER BY pc.created_at DESC LIMIT 1) AS claim_state,
            (SELECT count(*)::int FROM product_follows f WHERE f.product_id=p.id) AS followers,
            (SELECT count(*)::int FROM product_comments c WHERE c.product_id=p.id AND c.hidden_at IS NULL) AS comments
            ,pe.status AS entitlement_status
       FROM products p
       LEFT JOIN product_owners po ON po.product_id=p.id AND po.user_id=$1
       LEFT JOIN pro_entitlements pe ON pe.product_id=p.id
      WHERE po.user_id=$1 OR p.created_by_user_id=$1 OR EXISTS(SELECT 1 FROM product_claims pc WHERE pc.product_id=p.id AND pc.requester_id=$1)
      ORDER BY p.created_at DESC,p.id`, [user.id],
  );
  return <main className="app-shell inner-page account-page"><header className="page-heading"><p className="eyebrow">Founder dashboard</p><h1>My products</h1><p>Manage your product, hear from users, and share your progress.</p><Link className="button button-primary" href="/submit">Submit another startup</Link></header>
    {products.length ? <div className="account-product-list">{products.map((product) => <article key={product.id}><ProductLogo productName={product.name} productUrl={product.website_url} imageUrl={product.logo_url} className="product-list-logo"/><div><div className="startup-name-line"><h2><Link href={product.status === "published" ? `/product/${product.slug}` : `/manage/${product.slug}`}>{product.name}</Link></h2>{product.entitlement_status === "active" ? <ProBadge /> : null}</div><p>{product.tagline}</p><div className="startup-meta"><span>{product.status.replaceAll("_", " ")}</span><span>{product.ownership_role ? "Ownership confirmed" : product.claim_state === "pending" ? "Claim pending" : "Ownership not verified"}</span><span>{product.followers} followers</span><span>{product.comments} comments</span></div></div><div className="button-row">{product.ownership_role ? <><Link className="button button-secondary" href={`/manage/${product.slug}`}>Manage</Link>{product.entitlement_status === "active" ? <Link className="button button-primary" href={`/manage/${product.slug}/launch-kit`}>Open launch kit</Link> : product.status === "published" ? <Link className="button button-primary" href={`/manage/${product.slug}/pro`}>Upgrade to Pro</Link> : null}</> : <Link className="button button-secondary" href={`/claim/${product.slug}`}>Continue claim</Link>}</div></article>)}</div> : <div className="empty-state"><h2>No products attached to this account</h2><p>Submit a startup or claim an existing listing. Existing public profiles and their history remain available while unclaimed.</p><div><Link className="button button-primary" href="/submit">Submit a startup</Link><Link className="button button-secondary" href="/?view=discover#products">Find a product to claim</Link></div></div>}
  </main>;
}
