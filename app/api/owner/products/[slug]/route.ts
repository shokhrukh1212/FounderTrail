import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateOwner } from "@/lib/owner-auth";
import { requestOriginIsSameSite } from "@/lib/request-security";

function clean(value: unknown, max: number): string | null { return typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : null; }

export async function PATCH(request: Request, context: RouteContext<"/api/owner/products/[slug]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = clean(body?.name, 80), tagline = clean(body?.tagline, 180), description = clean(body?.description, 5000), mechanism = clean(body?.biddingMechanism, 2000), founder = clean(body?.founderName, 120);
  const social = typeof body?.founderSocialHandle === "string" && body.founderSocialHandle.trim().length <= 120 ? body.founderSocialHandle.trim() || null : null;
  if (!name || !tagline || !description || !mechanism || !founder) return NextResponse.json({ error: "Complete all required fields within their limits." }, { status: 400 });
  await query(`UPDATE products SET name=$2, tagline=$3, description=$4, bidding_mechanism=$5, founder_name=$6, founder_social_handle=$7, updated_at=now() WHERE id=$1::uuid`, [owner.productId, name, tagline, description, mechanism, founder, social]);
  return NextResponse.json({ message: "Saved." });
}
