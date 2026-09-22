import { NextResponse } from "next/server";
import { isObviousBot } from "@/lib/click";
import { BIDINDEX_VISITOR_COOKIE, bidIndexVisitorCookieOptions, ensureBidIndexVisitor } from "@/lib/bidindex-visitor";
import { withTransaction } from "@/lib/db";
import { createReachedMilestones } from "@/lib/founder-growth";
import { ownerTokenFromRequest } from "@/lib/bidindex-owner";
import { ownerCredentialMatches } from "@/lib/owner-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { networkHash, requestOriginIsSameSite } from "@/lib/request-security";
import { countAllTimeVisitors, getVisitorTotal } from "@/lib/visitors";
import { currentUserFromHeaders } from "@/lib/auth";

export const dynamic = "force-dynamic";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET() {
  return NextResponse.json({ visitors: await getVisitorTotal() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Expected JSON." }, { status: 415 });
  }
  const body = await request.json().catch(() => null) as { path?: unknown; productSlug?: unknown; ref?: unknown } | null;
  const path = typeof body?.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 500) : "/";
  const productSlug = typeof body?.productSlug === "string" && SLUG.test(body.productSlug) ? body.productSlug : null;
  const referralSlug = typeof body?.ref === "string" && SLUG.test(body.ref) ? body.ref : null;
  const visitor = ensureBidIndexVisitor(request);
  const accountUser = await currentUserFromHeaders(request.headers).catch(() => null);
  const abuseHash = networkHash(request, "eligible-visitor");
  const cookies = request.headers.get("cookie") ?? "";
  const privateSession = /(?:^|;\s*)bidindex_admin=/.test(cookies) || /(?:^|;\s*)bidindex_owner_[a-f0-9]+=/.test(cookies);
  const eligible = !privateSession && !isObviousBot(request);

  try {
    const result = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, { action: "eligible-visitor", keyHash: abuseHash, limit: 60, windowSeconds: 3600 });
      const canCount = eligible && allowed;
      let firstVisitToday = false;
      if (canCount) {
        await client.query(
          `INSERT INTO visitors (id,eligible,network_hash) VALUES ($1::uuid,true,$2)
           ON CONFLICT (id) DO UPDATE SET last_seen_at=now()`, [visitor.id, abuseHash],
        );
        // All-time visitors counts one visit per browser per UTC day, so the same person
        // returning tomorrow adds to the total again.
        const day = await client.query(
          `INSERT INTO visitor_days (visitor_id,visit_date) VALUES ($1::uuid,(now() AT TIME ZONE 'UTC')::date)
           ON CONFLICT DO NOTHING RETURNING visit_date`, [visitor.id],
        );
        firstVisitToday = day.rowCount === 1;
      }

      if (productSlug) {
        const products = await client.query<{ id:string;token_hash:string;token_version:number;approved_at:Date|null }>(
          `SELECT p.id::text,o.token_hash,o.token_version,p.approved_at FROM products p JOIN product_owner_credentials o ON o.product_id=p.id WHERE p.slug=$1 AND p.status='published' AND ($2::boolean OR NOT p.is_demo)`,
          [productSlug, process.env.NODE_ENV !== "production"],
        );
        const product = products.rows[0];
        if (product) {
          const accountOwner = accountUser ? accountUser.role === "admin" || Boolean((await client.query(`SELECT 1 FROM product_owners WHERE product_id=$1::uuid AND user_id=$2`, [product.id, accountUser.id])).rowCount) : false;
          const owner = accountOwner || ownerCredentialMatches({ productId:product.id,tokenHash:product.token_hash,tokenVersion:product.token_version,approvedAt:product.approved_at }, ownerTokenFromRequest(request, product.id));
          const outcome = !allowed ? "rate_limited" : !eligible ? (isObviousBot(request) ? "bot" : "owner") : owner ? "owner" : "counted";
          const inserted = await client.query(
            `INSERT INTO product_listing_view_events (product_id,visitor_hash,network_hash,metric_date,outcome)
             VALUES ($1::uuid,$2,$3,(now() AT TIME ZONE 'UTC')::date,$4)
             ON CONFLICT (product_id,visitor_hash,metric_date) WHERE outcome='counted' DO NOTHING RETURNING id`,
            [product.id,visitor.hash,abuseHash,outcome],
          );
          if (outcome === "counted" && !inserted.rowCount) await client.query(
            `INSERT INTO product_listing_view_events (product_id,visitor_hash,network_hash,metric_date,outcome) VALUES ($1::uuid,$2,$3,(now() AT TIME ZONE 'UTC')::date,'duplicate')`,
            [product.id,visitor.hash,abuseHash],
          );
        }
      }

      if (referralSlug) {
        const products = await client.query<{ id:string;token_hash:string;token_version:number;approved_at:Date|null }>(
          `SELECT p.id::text,o.token_hash,o.token_version,p.approved_at FROM products p JOIN product_owner_credentials o ON o.product_id=p.id WHERE p.slug=$1 AND p.status='published' AND ($2::boolean OR NOT p.is_demo)`,
          [referralSlug, process.env.NODE_ENV !== "production"],
        );
        const product = products.rows[0];
        if (product) {
          const accountOwner = accountUser ? accountUser.role === "admin" || Boolean((await client.query(`SELECT 1 FROM product_owners WHERE product_id=$1::uuid AND user_id=$2`, [product.id, accountUser.id])).rowCount) : false;
          const owner = accountOwner || ownerCredentialMatches({ productId:product.id,tokenHash:product.token_hash,tokenVersion:product.token_version,approvedAt:product.approved_at }, ownerTokenFromRequest(request, product.id));
          const outcome = !allowed ? "rate_limited" : !eligible ? (isObviousBot(request) ? "bot" : "owner") : owner ? "owner" : "counted";
          const inserted = await client.query(
            `INSERT INTO founder_referral_events (source_product_id,visitor_hash,network_hash,landing_path,outcome)
             VALUES ($1::uuid,$2,$3,$4,$5)
             ON CONFLICT (source_product_id,visitor_hash) WHERE outcome='counted' DO NOTHING RETURNING id`,
            [product.id,visitor.hash,abuseHash,path,outcome],
          );
          if (outcome === "counted" && !inserted.rowCount) await client.query(
            `INSERT INTO founder_referral_events (source_product_id,visitor_hash,network_hash,landing_path,outcome) VALUES ($1::uuid,$2,$3,$4,'duplicate')`,
            [product.id,visitor.hash,abuseHash,path],
          );
        }
      }

      const total = await countAllTimeVisitors(client);
      if (firstVisitToday) await createReachedMilestones(client,total);
      return { visitors:total };
    });
    const response = NextResponse.json(result,{headers:{"cache-control":"no-store"}});
    if (visitor.isNew) response.cookies.set(BIDINDEX_VISITOR_COOKIE,visitor.id,bidIndexVisitorCookieOptions);
    return response;
  } catch (error) {
    console.error("visitor tracking failed",error instanceof Error?error.message:"unknown error");
    return NextResponse.json({ error:"Could not record visit." },{status:500});
  }
}
