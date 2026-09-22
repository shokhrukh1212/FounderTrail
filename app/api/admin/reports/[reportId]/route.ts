import { NextResponse } from "next/server";

import { validAdminRequest } from "@/lib/admin-auth";
import { currentUserFromHeaders } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function PUT(request: Request, context: RouteContext<"/api/admin/reports/[reportId]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await validAdminRequest(request))) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const actor = await currentUserFromHeaders(request.headers).catch(() => null);
  const { reportId } = await context.params;
  const body = await request.json().catch(() => null) as { action?: unknown } | null;
  const action = body?.action === "hide" || body?.action === "dismiss" ? body.action : null;
  if (!action) return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  const changed = await withTransaction(async (client) => {
    const found = await client.query<{ comment_id: string | null; update_id: string | null; product_id: string | null }>(`SELECT r.comment_id::text,r.update_id::text,coalesce(c.product_id,u.product_id)::text AS product_id FROM content_reports r LEFT JOIN product_comments c ON c.id=r.comment_id LEFT JOIN product_updates u ON u.id=r.update_id WHERE r.id=$1::uuid AND r.state='open' FOR UPDATE OF r`, [reportId]);
    const report = found.rows[0]; if (!report) return false;
    if (action === "hide" && report.comment_id) await client.query(`UPDATE product_comments SET hidden_at=coalesce(hidden_at,now()),hidden_by=$2 WHERE id=$1::uuid`, [report.comment_id, actor?.id ?? null]);
    if (action === "hide" && report.update_id) await client.query(`UPDATE product_updates SET status='archived',archived_at=coalesce(archived_at,now()),updated_at=now() WHERE id=$1::uuid`, [report.update_id]);
    await client.query(`UPDATE content_reports SET state=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$1::uuid`, [reportId, action === "hide" ? "resolved" : "dismissed", actor?.id ?? null]);
    await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details) VALUES($1,'admin',$2,$3::uuid,jsonb_build_object('reportId',$4::text,'decision',$5::text))`, [actor?.id ?? null, `content.report.${action === "hide" ? "resolved" : "dismissed"}`, report.product_id, reportId, action]);
    return true;
  });
  return changed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Report not found." }, { status: 404 });
}
