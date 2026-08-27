import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ownerCookieName, ownerCookieOptions, tokenHashMatches } from "@/lib/bidindex-owner";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/owner/session/[slug]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : null;
  const rows = await query<{ id: string; token_hash: string }>(`SELECT p.id::text, o.token_hash FROM products p JOIN product_owner_credentials o ON o.product_id = p.id WHERE p.slug = $1 LIMIT 1`, [slug]);
  const product = rows[0];
  if (!product || !tokenHashMatches(product.token_hash, token)) return NextResponse.json({ error: "Invalid management link." }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ownerCookieName(product.id), token!, ownerCookieOptions);
  return response;
}
