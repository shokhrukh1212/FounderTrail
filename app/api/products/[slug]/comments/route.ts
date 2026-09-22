import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/products/[slug]/comments">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { body?: unknown; parentId?: unknown } | null;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  if (!text || text.length > 2000) return NextResponse.json({ error: "Comment must be between 1 and 2,000 characters." }, { status: 400 });
  try {
    const comment = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, { action: "product-comment", keyHash: eventHash("product-comment:user", user.id), limit: 12, windowSeconds: 600 });
      if (!allowed) throw new Error("RATE_LIMITED");
      const product = await client.query<{ id: string }>(`SELECT id::text FROM products WHERE slug=$1 AND status='published'`, [slug]);
      if (!product.rows[0]) return null;
      if (parentId) {
        const parent = await client.query<{ parent_id: string | null }>(`SELECT parent_id::text FROM product_comments WHERE id=$1::uuid AND product_id=$2::uuid AND hidden_at IS NULL`, [parentId, product.rows[0].id]);
        if (!parent.rows[0] || parent.rows[0].parent_id) throw new Error("INVALID_PARENT");
      }
      const inserted = await client.query<{ id: string; created_at: Date }>(`INSERT INTO product_comments(product_id,author_id,parent_id,body) VALUES($1::uuid,$2,$3::uuid,$4) RETURNING id::text,created_at`, [product.rows[0].id, user.id, parentId, text]);
      return { id: inserted.rows[0].id, body: text, authorName: user.name, createdAt: inserted.rows[0].created_at.toISOString() };
    });
    return comment ? NextResponse.json({ comment }, { status: 201 }) : NextResponse.json({ error: "Product not found." }, { status: 404 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "RATE_LIMITED") return NextResponse.json({ error: "Too many comments. Try again later." }, { status: 429 });
    return NextResponse.json({ error: code === "INVALID_PARENT" ? "Replies can only be one level deep." : "Could not add comment." }, { status: 400 });
  }
}

export async function PATCH(request: Request, context: RouteContext<"/api/products/[slug]/comments">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers); if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { id?: unknown; body?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : ""; const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!id || !text || text.length > 2000) return NextResponse.json({ error: "Invalid comment." }, { status: 400 });
  const rows = await query<{ id: string }>(`UPDATE product_comments c SET body=$1,edited_at=now() FROM products p WHERE c.id=$2::uuid AND c.author_id=$3 AND c.product_id=p.id AND p.slug=$4 AND c.hidden_at IS NULL RETURNING c.id::text`, [text, id, user.id, slug]);
  return rows[0] ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Comment not found." }, { status: 404 });
}

export async function DELETE(request: Request, context: RouteContext<"/api/products/[slug]/comments">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers); if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const rows = await query<{ id: string }>(`UPDATE product_comments c SET hidden_at=now(),hidden_by=$3 FROM products p WHERE c.id=$1::uuid AND c.product_id=p.id AND p.slug=$2 AND c.author_id=$3 AND c.hidden_at IS NULL RETURNING c.id::text`, [id, slug, user.id]);
  return rows[0] ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Comment not found." }, { status: 404 });
}
