import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/comments/[commentId]/report">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers); if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { commentId } = await context.params;
  const body = await request.json().catch(() => null) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) return NextResponse.json({ error: "Add a short reason." }, { status: 400 });
  try {
    const id = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, { action: "content-report", keyHash: eventHash("content-report:user", user.id), limit: 10, windowSeconds: 3600 });
      if (!allowed) throw new Error("RATE_LIMITED");
      return client.query<{ id: string }>(`INSERT INTO content_reports(reporter_id,comment_id,reason) SELECT $1,id,$3 FROM product_comments WHERE id=$2::uuid AND hidden_at IS NULL RETURNING id::text`, [user.id, commentId, reason]);
    });
    return id.rows[0] ? NextResponse.json({ ok: true }, { status: 201 }) : NextResponse.json({ error: "Comment not found." }, { status: 404 });
  } catch (error) {
    const code = error as { code?: string; message?: string };
    if (code.message === "RATE_LIMITED") return NextResponse.json({ error: "Too many reports. Try again later." }, { status: 429 });
    if (code.code === "23505") return NextResponse.json({ ok: true, alreadyReported: true });
    return NextResponse.json({ error: "Could not report this comment." }, { status: 500 });
  }
}
