import { NextResponse } from "next/server";

import { validAdminRequest } from "@/lib/admin-auth";
import { sendApprovalEmail } from "@/lib/approval-email";
import { query } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/admin/products/[slug]/approval-email">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await validAdminRequest(request))) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { slug } = await context.params;
  const rows = await query<{ id: string }>(`SELECT id::text FROM products WHERE slug=$1 AND status='published' LIMIT 1`, [slug]);
  if (!rows[0]) return NextResponse.json({ error: "Published product not found." }, { status: 404 });
  try {
    const email = await sendApprovalEmail(rows[0].id, { allowSkipped: true });
    const ok = email.status === "sent" || email.status === "already_sent" || email.status === "in_progress";
    return NextResponse.json({ email }, { status: ok ? 200 : 503 });
  } catch {
    console.error("approval email retry failed", { productId: rows[0].id, code: "unexpected_retry_error" });
    return NextResponse.json({ error: "Could not retry the approval email." }, { status: 500 });
  }
}
