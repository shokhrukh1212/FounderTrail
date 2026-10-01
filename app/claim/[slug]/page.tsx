import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { signInUrl } from "@/lib/return-to";
import { ProductClaim } from "@/components/ProductClaim";
import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify product ownership", robots: { index: false, follow: false } };

export default async function ClaimPage({ params }: PageProps<"/claim/[slug]">) {
  const { slug } = await params; const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(signInUrl(`/claim/${slug}`));
  const owned = await query(`SELECT 1 FROM product_owners po JOIN products p ON p.id=po.product_id WHERE p.slug=$1 AND po.user_id=$2`,[slug,user.id]);
  if(owned.length) redirect(`/manage/${slug}/launch`);
  const rows = await query<{ name: string; state: "claimed"|"pending"|"disputed"|"unclaimed" }>(`SELECT p.name,CASE WHEN EXISTS(SELECT 1 FROM product_claims pc WHERE pc.product_id=p.id AND pc.requester_id=$2 AND pc.state='disputed') THEN 'disputed' WHEN EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id) THEN 'claimed' WHEN EXISTS(SELECT 1 FROM product_claims pc WHERE pc.product_id=p.id AND pc.state='pending') THEN 'pending' ELSE 'unclaimed' END AS state FROM products p WHERE p.slug=$1 AND (p.status='published' OR p.created_by_user_id=$2 OR EXISTS(SELECT 1 FROM product_claims pc WHERE pc.product_id=p.id AND pc.requester_id=$2))`, [slug, user.id]);
  const product = rows[0]; if (!product) notFound();
  return <main className="app-shell inner-page account-page"><header className="page-heading"><p className="eyebrow">Ownership verification</p><h1>{product.name}</h1><p>Domain proof attaches this account to the existing product without changing its history.</p></header><ProductClaim slug={slug} signedIn state={product.state} /></main>;
}
