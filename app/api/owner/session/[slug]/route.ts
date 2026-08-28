import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { ownerCookieName, ownerCookieOptions } from "@/lib/bidindex-owner";
import { ownerCredentialMatches } from "@/lib/owner-auth";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/owner/session/[slug]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { token?: unknown; approvalToken?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : typeof body?.approvalToken === "string" ? body.approvalToken : null;
  const rows = await query<{ id: string; token_hash: string; token_version: number; approved_at: Date | null }>(`SELECT p.id::text,p.approved_at,o.token_hash,o.token_version FROM products p JOIN product_owner_credentials o ON o.product_id=p.id WHERE p.slug=$1 LIMIT 1`, [slug]);
  const product = rows[0];
  if (!product || !ownerCredentialMatches({ productId: product.id, tokenHash: product.token_hash, tokenVersion: product.token_version, approvedAt: product.approved_at }, token)) return NextResponse.json({ error: "Invalid management link." }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ownerCookieName(product.id), token!, ownerCookieOptions);
  return response;
}
