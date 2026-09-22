import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUserFromHeaders } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function PATCH(request: Request) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { digestOptedIn?: unknown } | null;
  if (typeof body?.digestOptedIn !== "boolean") return NextResponse.json({ error: "Invalid preference." }, { status: 400 });
  await query(`UPDATE app_users SET digest_opted_in=$2,digest_unsubscribed_at=CASE WHEN $2 THEN NULL ELSE now() END,updated_at=now() WHERE id=$1`, [user.id, body.digestOptedIn]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const deletedEmail = `deleted+${createHash("sha256").update(user.id).digest("hex")}@deleted.invalid`;
  try {
    await withTransaction(async (client) => {
      const rows = await client.query<{ email: string; role: string }>(`SELECT email,role FROM app_users WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [user.id]);
      const account = rows.rows[0];
      if (!account) throw new Error("NOT_FOUND");
      const attached = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM product_owners WHERE user_id=$1`, [user.id]);
      if ((attached.rows[0]?.count ?? 0) > 0) throw new Error("OWNS_PRODUCTS");
      if (account.role === "admin") {
        const others = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM app_users WHERE role='admin' AND deleted_at IS NULL AND id<>$1`, [user.id]);
        if ((others.rows[0]?.count ?? 0) === 0) throw new Error("LAST_ADMIN");
      }
      await client.query(`DELETE FROM auth_sessions WHERE user_id=$1`, [user.id]);
      await client.query(`DELETE FROM auth_accounts WHERE user_id=$1`, [user.id]);
      await client.query(`DELETE FROM auth_verifications WHERE position('"email":' || to_json($1::text)::text IN value) > 0`, [account.email]);
      await client.query(`UPDATE app_users SET name='Deleted member',email=$2,email_verified=false,image=NULL,role='member',digest_opted_in=false,digest_unsubscribed_at=coalesce(digest_unsubscribed_at,now()),deleted_at=now(),updated_at=now() WHERE id=$1`, [user.id, deletedEmail]);
      await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,details) VALUES($1,'user','account.deleted',jsonb_build_object('retainedPublicContributions',true,'retainedTransactions',true))`, [user.id]);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "OWNS_PRODUCTS") return NextResponse.json({ error: "Ask an administrator to transfer or release every managed product before deleting this account." }, { status: 409 });
    if (code === "LAST_ADMIN") return NextResponse.json({ error: "Grant another administrator before deleting the final admin account." }, { status: 409 });
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Account not found." }, { status: 404 });
    return NextResponse.json({ error: "Could not delete this account." }, { status: 500 });
  }
}
