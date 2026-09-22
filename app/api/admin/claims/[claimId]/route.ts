import { NextResponse } from "next/server";

import { validAdminRequest } from "@/lib/admin-auth";
import { currentUserFromHeaders } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function PUT(request: Request, context: RouteContext<"/api/admin/claims/[claimId]">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await validAdminRequest(request))) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const actor = await currentUserFromHeaders(request.headers).catch(() => null);
  const { claimId } = await context.params;
  const body = await request.json().catch(() => null) as { action?: unknown; reason?: unknown } | null;
  const action = body?.action === "approve" || body?.action === "reject" ? body.action : null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : "";
  if (!action || !reason) return NextResponse.json({ error: "Choose an action and record a reason." }, { status: 400 });
  try {
    const changed = await withTransaction(async (client) => {
      const result = await client.query<{ product_id: string; requester_id: string }>(`SELECT product_id::text,requester_id FROM product_claims WHERE id=$1::uuid AND state IN ('pending','disputed') FOR UPDATE`, [claimId]);
      const claim = result.rows[0]; if (!claim) return false;
      if (action === "approve") {
        const owned = await client.query(`SELECT 1 FROM product_owners WHERE product_id=$1::uuid FOR UPDATE`, [claim.product_id]);
        if (owned.rowCount) throw new Error("ALREADY_OWNED");
        await client.query(`INSERT INTO product_owners(product_id,user_id,ownership_role,verified_at,verification_method,approved_by) VALUES($1::uuid,$2,'owner',now(),'manual_admin',$3)`, [claim.product_id, claim.requester_id, actor?.id ?? null]);
      }
      await client.query(`UPDATE product_claims SET state=$2,reviewed_by=$3,reviewed_at=now(),reviewer_reason=$4,challenge_token_hash=NULL,challenge_expires_at=NULL,updated_at=now() WHERE id=$1::uuid`, [claimId, action === "approve" ? "claimed" : "rejected", actor?.id ?? null, reason]);
      await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,claim_id,details) VALUES($1,'admin',$2,$3::uuid,$4::uuid,jsonb_build_object('reason',$5))`, [actor?.id ?? null, `product.claim.${action}d`, claim.product_id, claimId, reason]);
      return true;
    });
    return changed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Claim not found or already reviewed." }, { status: 404 });
  } catch (error) {
    if (error instanceof Error && error.message === "ALREADY_OWNED") return NextResponse.json({ error: "This product already has an owner. Resolve the dispute before changing ownership." }, { status: 409 });
    return NextResponse.json({ error: "Could not review the claim." }, { status: 500 });
  }
}
