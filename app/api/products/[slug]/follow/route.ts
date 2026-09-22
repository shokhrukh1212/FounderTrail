import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";

export async function PUT(request: Request, context: RouteContext<"/api/products/[slug]/follow">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { active?: unknown } | null;
  if (typeof body?.active !== "boolean") return NextResponse.json({ error: "Invalid follow state." }, { status: 400 });
  try {
    const result = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, { action: "product-follow", keyHash: eventHash("product-follow:user", user.id), limit: 40, windowSeconds: 600 });
      if (!allowed) throw new Error("RATE_LIMITED");
      const product = await client.query<{ id: string }>(`SELECT id::text FROM products WHERE slug=$1 AND status='published'`, [slug]);
      if (!product.rows[0]) return null;
      if (body.active) await client.query(`INSERT INTO product_follows(product_id,user_id) VALUES($1::uuid,$2) ON CONFLICT DO NOTHING`, [product.rows[0].id, user.id]);
      else await client.query(`DELETE FROM product_follows WHERE product_id=$1::uuid AND user_id=$2`, [product.rows[0].id, user.id]);
      const count = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM product_follows WHERE product_id=$1::uuid`, [product.rows[0].id]);
      return { active: body.active, count: count.rows[0]?.count ?? 0 };
    });
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Product not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") return NextResponse.json({ error: "Too many follow changes. Try again later." }, { status: 429 });
    return NextResponse.json({ error: "Could not update follow." }, { status: 500 });
  }
}
