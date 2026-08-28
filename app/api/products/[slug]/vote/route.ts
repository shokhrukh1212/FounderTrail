import { NextResponse } from "next/server";
import { BIDINDEX_VISITOR_COOKIE, bidIndexVisitorCookieOptions, ensureBidIndexVisitor } from "@/lib/bidindex-visitor";
import { withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { networkHash, requestOriginIsSameSite } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: RouteContext<"/api/products/[slug]/vote">) {
  if (!requestOriginIsSameSite(request)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Expected JSON." }, { status: 415 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const active = typeof body === "object" && body !== null
    ? (body as Record<string, unknown>).active
    : undefined;
  if (typeof active !== "boolean") {
    return NextResponse.json({ error: "active must be a boolean." }, { status: 400 });
  }
  const { slug } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  const visitor = ensureBidIndexVisitor(request);
  const abuseHash = networkHash(request, "vote");
  try {
    const outcome = await withTransaction(async (client) => {
      const visitorAllowed = await consumeRateLimit(client, {
        action: "vote:visitor", keyHash: visitor.hash, limit: 12, windowSeconds: 600,
      });
      const networkAllowed = await consumeRateLimit(client, {
        action: "vote:network", keyHash: abuseHash, limit: 40, windowSeconds: 600,
      });
      if (!visitorAllowed || !networkAllowed) return { rateLimited: true as const };
      const product = await client.query<{ id: string; is_demo: boolean }>(
        `SELECT id::text, is_demo FROM products WHERE slug = $1 AND status = 'published' AND ($2::boolean OR NOT is_demo)`,
        [slug,process.env.NODE_ENV!=="production"],
      );
      if (!product.rows[0]) return { notFound: true as const };
      await client.query(
        `INSERT INTO product_votes
           (product_id, voter_hash, network_hash, active, is_demo, first_upvoted_at, updated_at)
         VALUES ($1::uuid,$2,$3,$4,false,now(),now())
         ON CONFLICT (product_id, voter_hash) DO UPDATE
           SET active = EXCLUDED.active, network_hash = EXCLUDED.network_hash, updated_at = now()`,
        [product.rows[0].id, visitor.hash, abuseHash, active],
      );
      const count = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM product_votes WHERE product_id = $1 AND active`,
        [product.rows[0].id],
      );
      return { active, count: count.rows[0]?.count ?? 0 };
    });
    if ("rateLimited" in outcome) {
      return NextResponse.json({ error: "Too many vote attempts." }, { status: 429 });
    }
    if ("notFound" in outcome) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    const response = NextResponse.json(outcome);
    if (visitor.isNew) response.cookies.set(BIDINDEX_VISITOR_COOKIE, visitor.id, bidIndexVisitorCookieOptions);
    return response;
  } catch (error) {
    console.error("vote update failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ error: "Could not update vote." }, { status: 500 });
  }
}
