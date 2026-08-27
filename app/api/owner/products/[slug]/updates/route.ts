import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateOwner } from "@/lib/owner-auth";
import { publicHttpUrl } from "@/lib/product-validation";
import { requestOriginIsSameSite } from "@/lib/request-security";

const TYPES = new Set(["feature","milestone","launch","announcement"]);
export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/updates">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params; const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const type = typeof body?.type === "string" ? body.type : ""; const title = typeof body?.title === "string" ? body.title.trim() : ""; const updateBody = typeof body?.body === "string" ? body.body.trim() : "";
  if (!TYPES.has(type) || !title || title.length > 140 || !updateBody || updateBody.length > 1500) return NextResponse.json({ error: "Enter a valid update type, title, and short body." }, { status: 400 });
  let link: string | null = null;
  if (typeof body?.linkUrl === "string" && body.linkUrl.trim()) { const checked = publicHttpUrl(body.linkUrl); if (!checked.ok) return NextResponse.json({ error: "Enter a valid public update URL." }, { status: 400 }); link = checked.url; }
  await query(`INSERT INTO product_updates (product_id,type,title,body,link_url) VALUES ($1::uuid,$2,$3,$4,$5)`, [owner.productId,type,title,updateBody,link]);
  return NextResponse.json({ message: "Published." }, { status: 201 });
}
