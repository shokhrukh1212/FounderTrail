import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";

/**
 * Canonical permanent product-upvote action. Historical anonymous rows remain
 * immutable; an authenticated member can only set or unset their own row.
 */
export async function PUT(request: Request, context: RouteContext<"/api/products/[slug]/vote">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { active?: unknown } | null;
  if (typeof body?.active !== "boolean") return NextResponse.json({ error: "Choose whether the upvote is active." }, { status: 400 });

  try {
    const result = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, {
        action: "product-upvote",
        keyHash: eventHash("product-upvote:user", user.id),
        limit: 30,
        windowSeconds: 600,
      });
      if (!allowed) throw new Error("RATE_LIMITED");

      const products = await client.query<{ id: string; is_demo: boolean }>(
        `SELECT id::text,is_demo FROM products WHERE slug=$1 AND status='published' FOR UPDATE`,
        [slug],
      );
      const product = products.rows[0];
      if (!product) return null;
      const owner = await client.query(`SELECT 1 FROM product_owners WHERE product_id=$1::uuid AND user_id=$2`, [product.id, user.id]);
      if (owner.rowCount) throw new Error("OWNER_VOTE");

      const previous = await client.query<{ first_upvoted_at: Date; active: boolean }>(
        `SELECT first_upvoted_at,active FROM product_votes WHERE product_id=$1::uuid AND user_id=$2 FOR UPDATE`,
        [product.id, user.id],
      );
      if (body.active) {
        if (previous.rows[0]) {
          await client.query(`UPDATE product_votes SET active=true,updated_at=now() WHERE product_id=$1::uuid AND user_id=$2`, [product.id, user.id]);
        } else {
          await client.query(
            `INSERT INTO product_votes(product_id,voter_hash,network_hash,active,is_demo,first_upvoted_at,updated_at,user_id)
             VALUES($1::uuid,encode(digest('foundertrail-product-vote-v1:'||$2,'sha256'),'hex'),
               encode(digest('foundertrail-product-vote-network-v1:'||$2,'sha256'),'hex'),true,false,now(),now(),$2)`,
            [product.id, user.id],
          );
        }
      } else if (previous.rows[0]) {
        await client.query(`UPDATE product_votes SET active=false,updated_at=now() WHERE product_id=$1::uuid AND user_id=$2`, [product.id, user.id]);
      }

      const vote = await client.query<{ first_upvoted_at: Date; active: boolean }>(
        `SELECT first_upvoted_at,active FROM product_votes WHERE product_id=$1::uuid AND user_id=$2`,
        [product.id, user.id],
      );
      const liveLaunch = await client.query<{ id: string; starts_at: Date; ends_at: Date }>(
        `SELECT pl.id::text,lw.starts_at,lw.ends_at FROM product_launches pl
          JOIN launch_weeks lw ON lw.id=pl.launch_week_id
         WHERE pl.product_id=$1::uuid AND pl.state IN ('scheduled','active')
           AND lw.state IN ('scheduled','active') AND lw.starts_at<=now() AND now()<lw.ends_at
         ORDER BY lw.starts_at DESC LIMIT 1 FOR UPDATE OF pl,lw`,
        [product.id],
      );
      const launch = liveLaunch.rows[0];
      const first = vote.rows[0]?.first_upvoted_at ? new Date(vote.rows[0].first_upvoted_at) : null;
      const launchEligible = Boolean(launch && first && first >= new Date(launch.starts_at) && first < new Date(launch.ends_at));
      if (launch && launchEligible) {
        await client.query(
          `INSERT INTO launch_votes(launch_id,user_id,active,created_at,updated_at)
           VALUES($1::uuid,$2,$3,$4,now())
           ON CONFLICT(launch_id,user_id) DO UPDATE SET active=EXCLUDED.active,updated_at=now()`,
          [launch.id, user.id, body.active, first],
        );
      }

      const totals = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM product_votes WHERE product_id=$1::uuid AND active AND ($2::boolean OR NOT is_demo)`,
        [product.id, product.is_demo],
      );
      const weekly = launch ? await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM launch_votes WHERE launch_id=$1::uuid AND active`,
        [launch.id],
      ) : null;
      await client.query(
        `INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details)
         VALUES($1,'user',$2,$3::uuid,jsonb_build_object('active',$4,'launchEligible',$5))`,
        [user.id, body.active ? "product_upvote_set" : "product_upvote_unset", product.id, body.active, launchEligible],
      );
      return { active: Boolean(vote.rows[0]?.active), count: totals.rows[0]?.count ?? 0, weeklyCount: weekly?.rows[0]?.count ?? null };
    });
    if (!result) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "OWNER_VOTE") return NextResponse.json({ error: "Owners cannot upvote their own product." }, { status: 403 });
    if (error instanceof Error && error.message === "RATE_LIMITED") return NextResponse.json({ error: "Too many vote changes. Try again later." }, { status: 429 });
    console.error("product upvote failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not update the upvote." }, { status: 500 });
  }
}
