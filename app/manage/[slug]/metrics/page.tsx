import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { StripeMetricsManager } from "@/components/StripeMetricsManager";
import { currentUserFromHeaders } from "@/lib/auth";
import { config } from "@/lib/config";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Product metrics", robots: { index: false, follow: false } };

export default async function MetricsPage({ params }: PageProps<"/manage/[slug]/metrics">) {
  const { slug } = await params;
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(`/manage/${slug}/metrics`)}`);
  const products = await query<{ id: string; name: string }>(`SELECT p.id::text,p.name FROM products p WHERE p.slug=$1 AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2)`, [slug, user.id]);
  const product = products[0]; if (!product) notFound();
  const connections = await query<{ id: string; provider_account_id: string | null; scope_mode: string; provider_product_ids: string[]; publish_revenue: boolean; publish_mrr: boolean; status: string; last_synced_at: Date | null; last_error: string | null }>(`SELECT id::text,provider_account_id,scope_mode,provider_product_ids,publish_revenue,publish_mrr,status,last_synced_at,last_error FROM metric_connections WHERE product_id=$1::uuid AND provider='stripe' AND disconnected_at IS NULL`, [product.id]);
  const item = connections[0];
  return <main className="app-shell inner-page account-page"><header className="page-heading"><p className="eyebrow">Metrics · {product.name}</p><h1>Optional connected metrics</h1><p>Connect privately, choose the exact product scope, and separately decide whether any aggregate is public.</p><Link className="text-link" href={`/manage/${slug}`}>← Back to product dashboard</Link></header><section className="settings-card"><h2>Stripe restricted read-only connection</h2><StripeMetricsManager slug={slug} configured={config.founderMetricsEnabled && Boolean(config.metricEncryptionKey)} initialConnection={item ? { id: item.id, accountId: item.provider_account_id, scopeMode: item.scope_mode, providerProductIds: item.provider_product_ids, publishRevenue: item.publish_revenue, publishMrr: item.publish_mrr, status: item.status, lastSyncedAt: item.last_synced_at?.toISOString() ?? null, lastError: item.last_error } : null} /></section><section className="policy-note"><h2>What the labels mean</h2><p>Revenue connected confirms a defined Stripe source and scope; it is not an audit of profitability. No connection appears publicly as “Revenue not shared.” A stale connection keeps its timestamp. Founder-reported milestones remain labelled separately.</p></section></main>;
}
