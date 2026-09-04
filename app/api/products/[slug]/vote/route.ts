import { NextResponse } from "next/server";
import { BIDINDEX_VISITOR_COOKIE, bidIndexVisitorCookieOptions, ensureBidIndexVisitor } from "@/lib/bidindex-visitor";
import { withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { networkBlockHash, requestOriginIsSameSite } from "@/lib/request-security";
import { isObviousBot } from "@/lib/click";
import { ownerTokenFromRequest } from "@/lib/bidindex-owner";
import { ownerCredentialMatches } from "@/lib/owner-auth";

export const dynamic = "force-dynamic";

/**
 * At most this many active upvotes on one product may come from one address block. Vote
 * stuffing always concentrates that way: the identity is a cookie the sender controls, so
 * clearing it mints a fresh voter, but the address block stays put. Small NAT sharing (a
 * couple of flatmates, one office) still gets through.
 */
const VOTES_PER_PRODUCT_PER_NETWORK = 3;

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
  const abuseHash = networkBlockHash(request, "vote");
  try {
    const outcome = await withTransaction(async (client) => {
      if (isObviousBot(request)) {
        await client.query(`INSERT INTO product_vote_events(visitor_hash,network_hash,outcome) VALUES($1,$2,'bot')`,[visitor.hash,abuseHash]);
        return { blocked: true as const };
      }
      const visitorAllowed = await consumeRateLimit(client, {
        action: "vote:visitor", keyHash: visitor.hash, limit: 12, windowSeconds: 600,
      });
      const networkAllowed = await consumeRateLimit(client, {
        action: "vote:network", keyHash: abuseHash, limit: 10, windowSeconds: 3600,
      });
      // A caller that sends no cookie is handed a new identity here, so `vote:visitor`
      // opens a fresh allowance on every request and can never bind. A first-time voter
      // still votes on the spot with no reload; a cookie-less script gets this bucket.
      const newVisitorAllowed = !visitor.isNew || await consumeRateLimit(client, {
        action: "vote:new-visitor", keyHash: abuseHash, limit: 3, windowSeconds: 3600,
      });
      if (!visitorAllowed || !networkAllowed || !newVisitorAllowed) {await client.query(`INSERT INTO product_vote_events(visitor_hash,network_hash,outcome) VALUES($1,$2,'rate_limited')`,[visitor.hash,abuseHash]);return { rateLimited: true as const };}
      const product = await client.query<{ id: string; is_demo: boolean; token_hash:string;token_version:number;approved_at:Date|null }>(
        `SELECT p.id::text,p.is_demo,o.token_hash,o.token_version,p.approved_at FROM products p JOIN product_owner_credentials o ON o.product_id=p.id WHERE p.slug = $1 AND p.status = 'published' AND ($2::boolean OR NOT p.is_demo)`,
        [slug,process.env.NODE_ENV!=="production"],
      );
      if (!product.rows[0]) {await client.query(`INSERT INTO product_vote_events(visitor_hash,network_hash,outcome) VALUES($1,$2,'not_found')`,[visitor.hash,abuseHash]);return { notFound: true as const };}
      const selected=product.rows[0];
      if(ownerCredentialMatches({productId:selected.id,tokenHash:selected.token_hash,tokenVersion:selected.token_version,approvedAt:selected.approved_at},ownerTokenFromRequest(request,selected.id))){await client.query(`INSERT INTO product_vote_events(product_id,visitor_hash,network_hash,outcome) VALUES($1::uuid,$2,$3,'owner')`,[selected.id,visitor.hash,abuseHash]);return{blocked:true as const}}
      if (active) {
        const fromNetwork = await client.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM product_votes
            WHERE product_id = $1::uuid AND active AND network_hash = $2 AND voter_hash <> $3`,
          [selected.id, abuseHash, visitor.hash],
        );
        if ((fromNetwork.rows[0]?.count ?? 0) >= VOTES_PER_PRODUCT_PER_NETWORK) {
          await client.query(`INSERT INTO product_vote_events(product_id,visitor_hash,network_hash,outcome) VALUES($1::uuid,$2,$3,'rate_limited')`,[selected.id,visitor.hash,abuseHash]);
          return { stuffed: true as const };
        }
      }
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
      await client.query(`INSERT INTO product_vote_events(product_id,visitor_hash,network_hash,outcome) VALUES($1::uuid,$2,$3,$4)`,[product.rows[0].id,visitor.hash,abuseHash,active?"counted":"removed"]);
      return { active, count: count.rows[0]?.count ?? 0 };
    });
    if ("rateLimited" in outcome) {
      return NextResponse.json({ error: "Too many vote attempts." }, { status: 429 });
    }
    if ("stuffed" in outcome) {
      return NextResponse.json({ error: "This network has already upvoted this product." }, { status: 429 });
    }
    if ("blocked" in outcome) return NextResponse.json({ error: "This vote is not eligible." }, { status: 403 });
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
