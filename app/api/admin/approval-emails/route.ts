import { NextResponse } from "next/server";
import { adminSessionFromRequest, validAdminSession } from "@/lib/admin-auth";
import { sendApprovalEmail } from "@/lib/approval-email";
import { query } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!validAdminSession(adminSessionFromRequest(request))) return NextResponse.json({ error: "Admin access required." }, { status: 401 });

  const products = await query<{ id: string }>(
    `SELECT id::text
       FROM products
      WHERE status='published' AND NOT is_demo AND approved_at IS NOT NULL
        AND approval_email_sent_at IS NULL
        AND approval_email_status IN ('not_sent','failed','skipped')
      ORDER BY approved_at
      LIMIT 25`,
  );
  let sent = 0; let alreadySent = 0; let failed = 0;
  for (const product of products) {
    const result = await sendApprovalEmail(product.id, { allowSkipped: true });
    if (result.status === "sent") sent += 1;
    else if (result.status === "already_sent" || result.status === "in_progress") alreadySent += 1;
    else failed += 1;
  }
  return NextResponse.json({ attempted: products.length, sent, alreadySent, failed });
}
