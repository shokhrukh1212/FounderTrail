import { NextResponse } from "next/server";
import { authenticateProOwner } from "@/lib/pro-access";
import { query } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/launch-kit/exports">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const access = await authenticateProOwner(request, slug);
  if (!access || access.entitlementStatus !== "active") return NextResponse.json({ error: "Active Pro access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { template?: unknown; format?: unknown; outcome?: unknown; errorCode?: unknown } | null;
  if (!body || !["spotlight","minimal"].includes(String(body.template)) || !["landscape","square"].includes(String(body.format)) || !["succeeded","failed"].includes(String(body.outcome))) return NextResponse.json({ error: "Invalid export result." }, { status: 400 });
  const errorCode = typeof body.errorCode === "string" ? body.errorCode.slice(0, 100) : null;
  await query(`INSERT INTO pro_export_events(product_id,user_id,template,format,outcome,error_code) VALUES($1::uuid,$2,$3,$4,$5,$6)`, [access.productId, access.userId, body.template, body.format, body.outcome, errorCode]);
  return NextResponse.json({ ok: true }, { status: 201 });
}
