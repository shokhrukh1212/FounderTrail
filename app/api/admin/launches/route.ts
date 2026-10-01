import { NextResponse } from "next/server";

import { validAdminRequest } from "@/lib/admin-auth";
import { currentUserFromHeaders } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await validAdminRequest(request))) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const actor = await currentUserFromHeaders(request.headers).catch(() => null);
  const body = await request.json().catch(() => null) as { productId?: unknown; weekStartsAt?: unknown } | null;
  const productId = typeof body?.productId === "string" ? body.productId : "";
  const start = typeof body?.weekStartsAt === "string" ? new Date(body.weekStartsAt) : new Date(Number.NaN);
  const now = new Date(); const currentMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7)));
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !Number.isFinite(start.getTime()) || start.getUTCDay() !== 1 || start.getUTCHours() || start.getUTCMinutes() || start.getUTCSeconds() || start.getUTCMilliseconds() || start.getTime() < currentMonday.getTime() || start.getTime() > Date.now() + 180 * 24 * 60 * 60 * 1000) return NextResponse.json({ error: "Choose this week or a future Monday at 00:00 UTC within six months." }, { status: 400 });
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  try {
    const launch = await withTransaction(async (client) => {
      const product = await client.query<{ id: string }>(`SELECT id::text FROM products WHERE id=$1::uuid AND status='published' FOR UPDATE`, [productId]);
      if (!product.rows[0]) throw new Error("NOT_PUBLISHED");
      const week = await client.query<{ id: string }>(`INSERT INTO launch_weeks(starts_at,ends_at,state) VALUES($1,$2,CASE WHEN $1<=now() AND now()<$2 THEN 'active' ELSE 'scheduled' END) ON CONFLICT(starts_at) DO UPDATE SET ends_at=excluded.ends_at RETURNING id::text`, [start, end]);
      const saved = await client.query<{ id: string }>(`INSERT INTO product_launches(product_id,launch_week_id,state,approved_at,starts_at) VALUES($1::uuid,$2::uuid,CASE WHEN $3<=now() AND now()<$4 THEN 'active' ELSE 'scheduled' END,now(),GREATEST($3,now())) RETURNING id::text`, [productId, week.rows[0].id, start, end]);
      await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details) VALUES($1,'admin','launch.scheduled',$2::uuid,jsonb_build_object('startsAt',$3::text,'endsAt',$4::text))`, [actor?.id ?? null, productId, start.toISOString(), end.toISOString()]);
      return saved.rows[0].id;
    });
    return NextResponse.json({ id: launch }, { status: 201 });
  } catch (error) {
    const code = error as { code?: string; message?: string };
    if (code.message === "NOT_PUBLISHED") return NextResponse.json({ error: "Only approved public products can launch." }, { status: 400 });
    if (code.code === "23505") return NextResponse.json({ error: "This product already has its one FounderTrail launch." }, { status: 409 });
    return NextResponse.json({ error: "Could not schedule the launch." }, { status: 500 });
  }
}
