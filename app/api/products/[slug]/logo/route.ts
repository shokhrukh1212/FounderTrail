import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { fetchPublicLogo, fetchSubmissionMetadata } from "@/lib/submission-metadata";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext<"/api/products/[slug]/logo">) {
  const { slug } = await context.params;
  const rows = await query<{ logo_url: string | null; website_url: string }>(
    `SELECT sm.extracted_logo_url AS logo_url, p.website_url
       FROM products p
       JOIN product_submission_metadata sm ON sm.product_id = p.id
      WHERE p.slug = $1 AND p.status = 'published'
        AND ($2::boolean OR NOT p.is_demo)
      LIMIT 1`,
    [slug, process.env.NODE_ENV !== "production"],
  );
  const product = rows[0];
  let source = product?.logo_url ?? null;
  if (!source && product) source = (await fetchSubmissionMetadata(product.website_url)).logoUrl;
  if (!source) return new NextResponse(null, { status: 404, headers: { "cache-control": "no-store" } });
  const logo = await fetchPublicLogo([source]);
  if (!logo) return new NextResponse(null, { status: 404, headers: { "cache-control": "no-store" } });
  return new NextResponse(new Uint8Array(logo.bytes), {
    status: 200,
    headers: {
      "content-type": logo.contentType,
      "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "content-security-policy": "default-src 'none'; sandbox",
      "cross-origin-resource-policy": "same-origin",
      "x-content-type-options": "nosniff",
    },
  });
}
