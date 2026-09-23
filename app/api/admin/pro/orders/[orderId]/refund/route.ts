import { NextResponse } from "next/server";
import { validAdminRequest } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/admin/pro/orders/[orderId]/refund">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!await validAdminRequest(request)) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { orderId } = await context.params;
  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (reason.length < 3) return NextResponse.json({ error: "Provide an audit reason." }, { status: 400 });
  const rows = await query<{ dodo_payment_id: string | null; status: string }>(`SELECT dodo_payment_id,status FROM pro_launch_orders WHERE id=$1::uuid`, [orderId]).catch(() => []);
  const order = rows[0];
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.dodo_payment_id || !["paid","partially_refunded","payment_conflict","disputed","refund_pending"].includes(order.status)) return NextResponse.json({ error: "This order is not eligible for an automated full refund." }, { status: 409 });
  await query(`INSERT INTO notification_jobs(job_type,dedupe_key,payload) VALUES('pro_refund',$1,jsonb_build_object('orderId',$2::text,'reason',$3::text)) ON CONFLICT(dedupe_key) DO UPDATE SET state=CASE WHEN notification_jobs.state IN ('sent','processing') THEN notification_jobs.state ELSE 'pending' END,attempts=CASE WHEN notification_jobs.state='processing' THEN notification_jobs.attempts ELSE 0 END,available_at=now(),last_error=NULL`, [`pro-refund:${order.dodo_payment_id}`, orderId, reason]);
  await query(`UPDATE pro_launch_orders SET status='refund_pending',updated_at=now() WHERE id=$1::uuid`, [orderId]);
  return NextResponse.json({ ok: true, status: "refund_pending" }, { status: 202 });
}
