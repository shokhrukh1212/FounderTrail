import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { OwnerAccess } from "@/components/OwnerAccess";
import { OwnerDashboard } from "@/components/OwnerDashboard";
import { ownerCookieName, tokenHashMatches } from "@/lib/bidindex-owner";
import { query } from "@/lib/db";
import { getManagedProduct } from "@/lib/product-data";

export const dynamic = "force-dynamic";
export default async function ManagePage({ params }: PageProps<"/manage/[slug]">) {
  const { slug } = await params; const product = await getManagedProduct(slug); if (!product) notFound();
  const token = (await cookies()).get(ownerCookieName(product.id))?.value ?? null;
  if (!tokenHashMatches(product.ownerTokenHash, token)) return <main className="app-shell inner-page"><OwnerAccess slug={slug} /></main>;
  const clicks = await query<{ count: string }>(`SELECT count(*)::text AS count FROM product_outbound_click_events WHERE product_id=$1::uuid AND outcome='counted'`, [product.id]);
  const { ownerTokenHash: _, ...safeProduct } = product; void _;
  return <main className="app-shell inner-page manage-page"><OwnerDashboard product={safeProduct} outboundClicks={Number(clicks[0]?.count ?? 0)} /></main>;
}
