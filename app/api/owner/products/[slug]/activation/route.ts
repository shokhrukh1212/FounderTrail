import { NextResponse } from "next/server";
import { authenticateOwner } from "@/lib/owner-auth";
import { withTransaction } from "@/lib/db";
import { insertFunnelEvent, type FunnelEventName } from "@/lib/analytics";
import { requestOriginIsSameSite } from "@/lib/request-security";
const events: Record<string, FunnelEventName> = { viewed: "activation_workspace_viewed", copy_link: "public_link_copied", composer: "x_composer_opened", shared: "share_self_reported" };
export async function PATCH(request: Request, context: RouteContext<"/api/owner/products/[slug]/activation">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params; const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Management access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || (body.post !== undefined && (typeof body.post !== 'string' || body.post.length > 2000)) || (body.shareState !== undefined && !['todo','self_reported','skipped'].includes(body.shareState))) return NextResponse.json({ error: "Invalid workspace update." }, { status: 400 });
  await withTransaction(async client => {
    await client.query(`INSERT INTO product_activation(product_id,post_draft,share_state,composer_opened_at) VALUES($1::uuid,$2,coalesce($3,'todo'),CASE WHEN $4 THEN now() END)
      ON CONFLICT(product_id) DO UPDATE SET post_draft=coalesce($2,product_activation.post_draft),share_state=coalesce($3,product_activation.share_state),composer_opened_at=CASE WHEN $4 THEN now() ELSE product_activation.composer_opened_at END,updated_at=now()`, [owner.productId,body.post ?? null,body.shareState ?? null,body.event === 'composer']);
    const event = events[body.event];
    if (event) await insertFunnelEvent(client, { name: event, idempotencyKey: `${owner.productId}:${owner.userId}`, eventData: { productId: owner.productId } });
  });
  return NextResponse.json({ ok: true });
}
