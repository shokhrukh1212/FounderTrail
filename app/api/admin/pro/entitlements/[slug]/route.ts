import { NextResponse } from "next/server";
import { currentUserFromHeaders } from "@/lib/auth";
import { validAdminRequest } from "@/lib/admin-auth";
import { query, withTransaction } from "@/lib/db";
import { adminSetProEntitlement } from "@/lib/pro-launch";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/admin/pro/entitlements/[slug]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!await validAdminRequest(request)) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const actor = await currentUserFromHeaders(request.headers).catch(() => null);
  if (!actor || actor.role !== "admin") return NextResponse.json({ error: "A signed-in admin account is required for audited Pro actions." }, { status: 403 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { action?: unknown; reason?: unknown } | null;
  const action = body?.action;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if ((action !== "grant" && action !== "revoke" && action !== "restore") || reason.length < 3) return NextResponse.json({ error: "Choose an action and provide an audit reason." }, { status: 400 });
  const products = await query<{ id: string }>(`SELECT id::text FROM products WHERE slug=$1`, [slug]);
  if (!products[0]) return NextResponse.json({ error: "Startup not found." }, { status: 404 });
  try {
    await withTransaction((client) => adminSetProEntitlement(client, { productId: products[0].id, actorUserId: actor.id, action, reason }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "ENTITLEMENT_NOT_FOUND") return NextResponse.json({ error: "No Pro entitlement exists to change." }, { status: 409 });
    return NextResponse.json({ error: "Could not update Pro access." }, { status: 500 });
  }
}
