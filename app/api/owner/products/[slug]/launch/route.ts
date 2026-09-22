import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/launch">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { weekStartsAt?: unknown } | null;
  const start = typeof body?.weekStartsAt === "string" ? new Date(body.weekStartsAt) : new Date(Number.NaN);
  const now = new Date(); const currentMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  if (!Number.isFinite(start.getTime()) || start.getUTCDay() !== 1 || start.getUTCHours() || start.getUTCMinutes() || start.getUTCSeconds() || start.getUTCMilliseconds() || start.getTime() < currentMonday.getTime() || start.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: "Choose this week or a future Monday at 00:00 UTC within six months." }, { status: 400 });
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  try {
    const id = await withTransaction(async (client) => {
      const products = await client.query<{ id: string }>(`SELECT p.id::text FROM products p WHERE p.slug=$1 AND p.status='published' AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2) FOR UPDATE`, [slug, user.id]);
      const product = products.rows[0]; if (!product) throw new Error("NOT_ALLOWED");
      const week = await client.query<{ id: string }>(`INSERT INTO launch_weeks(starts_at,ends_at,state) VALUES($1,$2,CASE WHEN $1<=now() AND now()<$2 THEN 'active' ELSE 'scheduled' END) ON CONFLICT(starts_at) DO UPDATE SET ends_at=excluded.ends_at RETURNING id::text`, [start, end]);
      const launch = await client.query<{ id: string }>(`INSERT INTO product_launches(product_id,launch_week_id,state,approved_at) VALUES($1::uuid,$2::uuid,CASE WHEN $3<=now() AND now()<$4 THEN 'active' ELSE 'scheduled' END,now()) RETURNING id::text`, [product.id, week.rows[0].id, start, end]);
      await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details) VALUES($1,'user','launch.scheduled',$2::uuid,jsonb_build_object('startsAt',$3::text,'endsAt',$4::text))`, [user.id, product.id, start.toISOString(), end.toISOString()]);
      return launch.rows[0].id;
    });
    return NextResponse.json({ id, startsAt: start.toISOString(), endsAt: end.toISOString() }, { status: 201 });
  } catch (error) {
    const code = error as { code?: string; message?: string };
    if (code.message === "NOT_ALLOWED") return NextResponse.json({ error: "An approved product with verified ownership is required." }, { status: 403 });
    if (code.code === "23505") return NextResponse.json({ error: "This product already has its one FounderTrail launch." }, { status: 409 });
    return NextResponse.json({ error: "Could not schedule the launch." }, { status: 500 });
  }
}
