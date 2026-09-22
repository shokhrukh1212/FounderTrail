import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { authenticateOwner } from "@/lib/owner-auth";
import { publicHttpUrl } from "@/lib/product-validation";
import { requestOriginIsSameSite } from "@/lib/request-security";

const TYPES = new Set(["feature","improvement","milestone"]);
export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/updates">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params; const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const type = typeof body?.type === "string" ? body.type : ""; const title = typeof body?.title === "string" ? body.title.trim() : ""; const updateBody = typeof body?.body === "string" ? body.body.trim() : "";
  const status = body?.status === "draft" ? "draft" : "published";
  if (!TYPES.has(type) || !title || title.length > 140 || !updateBody || updateBody.length > 1500) return NextResponse.json({ error: "Enter a valid update type, title, and short body." }, { status: 400 });
  let link: string | null = null;
  if (typeof body?.linkUrl === "string" && body.linkUrl.trim()) { const checked = publicHttpUrl(body.linkUrl); if (!checked.ok) return NextResponse.json({ error: "Enter a valid public update URL." }, { status: 400 }); link = checked.url; }
  const inserted=await query<{id:string;published_at:Date|null;updated_at:Date}>(`INSERT INTO product_updates (product_id,type,title,body,link_url,status,published_at) VALUES ($1::uuid,$2,$3,$4,$5,$6,CASE WHEN $6='published' THEN now() ELSE NULL END) RETURNING id::text,published_at,updated_at`, [owner.productId,type,title,updateBody,link,status]);
  return NextResponse.json({ message: status === "draft" ? "Draft saved." : "Published.", update: { id: inserted[0].id, type, title, body: updateBody, linkUrl: link, status, publishedAt: inserted[0].published_at?.toISOString() ?? null, updatedAt: inserted[0].updated_at.toISOString(), imageUrl: null } }, { status: 201 });
}

export async function PATCH(request: Request, context: RouteContext<"/api/owner/products/[slug]/updates">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params; const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  const action = body?.action === "publish" || body?.action === "archive" || body?.action === "save" ? body.action : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !action) return NextResponse.json({ error: "Invalid update action." }, { status: 400 });
  if (action === "save") {
    const type = typeof body?.type === "string" ? body.type : ""; const title = typeof body?.title === "string" ? body.title.trim() : ""; const updateBody = typeof body?.body === "string" ? body.body.trim() : "";
    if (!TYPES.has(type) || !title || title.length > 140 || !updateBody || updateBody.length > 1500) return NextResponse.json({ error: "Enter a valid update type, title, and short body." }, { status: 400 });
    let link: string | null = null; if (typeof body?.linkUrl === "string" && body.linkUrl.trim()) { const checked = publicHttpUrl(body.linkUrl); if (!checked.ok) return NextResponse.json({ error: "Enter a valid public update URL." }, { status: 400 }); link = checked.url; }
    const changed = await query(`UPDATE product_updates SET type=$3,title=$4,body=$5,link_url=$6,updated_at=now() WHERE id=$1::uuid AND product_id=$2::uuid AND status IN ('draft','published') RETURNING id`, [id, owner.productId, type, title, updateBody, link]);
    return changed[0] ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Update not found." }, { status: 404 });
  }
  const changed = action === "publish"
    ? await query(`UPDATE product_updates SET status='published',published_at=coalesce(published_at,now()),archived_at=NULL,updated_at=now() WHERE id=$1::uuid AND product_id=$2::uuid AND status='draft' RETURNING id`, [id, owner.productId])
    : await query(`UPDATE product_updates SET status='archived',archived_at=now(),updated_at=now() WHERE id=$1::uuid AND product_id=$2::uuid AND status IN ('draft','published') RETURNING id`, [id, owner.productId]);
  return changed[0] ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Update cannot move to that state." }, { status: 409 });
}
