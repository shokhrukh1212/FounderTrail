import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = { title: "Launch your startup", robots: { index: false, follow: false } };
export default async function LaunchSelection() {
  const user = await currentUserFromHeaders(await headers());
  if (!user) redirect('/sign-in?returnTo=%2Flaunch');
  const products = await query<{slug:string;name:string}>(`SELECT p.slug,coalesce(p.short_name,p.name) AS name FROM products p WHERE p.status='published' AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$1) AND NOT EXISTS(SELECT 1 FROM product_launches pl WHERE pl.product_id=p.id AND pl.state<>'cancelled') ORDER BY p.created_at DESC`,[user.id]);
  if (!products.length) redirect('/submit');
  if (products.length === 1) redirect(`/manage/${products[0].slug}/launch`);
  return <main className="app-shell inner-page account-page"><header className="page-heading"><p className="eyebrow">Launch on FounderTrail</p><h1>Which startup are you launching?</h1><p>Your pages are already live. Choose one to join the launch list.</p></header><div className="activation-tasks">{products.map(product=><Link className="activation-task" key={product.slug} href={`/manage/${product.slug}/launch`}><strong>{product.name}</strong> <span>Launch & share →</span></Link>)}</div><p><Link href="/submit">Publish a new startup</Link></p></main>;
}
