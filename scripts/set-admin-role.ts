import { getPool } from "../lib/db";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const revoke = args.includes("--revoke");
const target = (args.find((value) => !value.startsWith("--")) ?? "").trim();

async function main() {
  if (!target) throw new Error("Usage: npm run foundertrail:set-admin -- <verified-email-or-user-id> [--apply] [--revoke]");
  if (apply && process.env.CONFIRM_ADMIN_ROLE?.trim() !== target) {
    throw new Error("Refusing to apply: CONFIRM_ADMIN_ROLE must exactly match the target argument.");
  }

  const pool = getPool();
  try {
    const users = await pool.query<{ id: string; name: string; email: string; email_verified: boolean; role: string; provider_id: string | null; account_id: string | null }>(
      `SELECT u.id,u.name,u.email,u.email_verified,u.role,a.provider_id,a.account_id
         FROM app_users u LEFT JOIN auth_accounts a ON a.user_id=u.id AND a.provider_id='google'
        WHERE u.deleted_at IS NULL AND (u.id=$1 OR lower(u.email)=lower($1))
        ORDER BY (a.provider_id='google') DESC,u.id`,
      [target],
    );
    if (users.rowCount !== 1) throw new Error(users.rowCount ? "Target is ambiguous; use the exact stable user ID." : "No active account matched. Sign in with Google first.");
    const user = users.rows[0];
    if (!user.email_verified || user.provider_id !== "google" || !user.account_id) throw new Error("The target must have a verified Google account linked before an admin role can be changed.");
    console.log(JSON.stringify({ environment: process.env.NODE_ENV || "unset", user: { id: user.id, name: user.name, maskedEmail: user.email.replace(/^(.).+(@.*)$/, "$1***$2"), provider: user.provider_id, currentRole: user.role }, requestedRole: revoke ? "member" : "admin", mode: apply ? "apply" : "preview" }, null, 2));
    if (!apply) {
      console.log(`Preview only. Re-run with CONFIRM_ADMIN_ROLE='${target}' and --apply after checking the environment and identity.`);
    } else {
      const role = revoke ? "member" : "admin";
      await pool.query("BEGIN");
      try {
        if (revoke && user.role === "admin") {
          const admins = await pool.query<{ count: number }>(`SELECT count(*)::int AS count FROM app_users WHERE role='admin' AND deleted_at IS NULL`);
          if ((admins.rows[0]?.count ?? 0) <= 1) throw new Error("Refusing to revoke the final active administrator.");
        }
        await pool.query(`UPDATE app_users SET role=$2,updated_at=now() WHERE id=$1`, [user.id, role]);
        await pool.query(`DELETE FROM auth_sessions WHERE user_id=$1`, [user.id]);
        await pool.query(
          `INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,details)
           VALUES($1,'system',$2,jsonb_build_object('targetUserId',$1::text,'previousRole',$3::text,'nextRole',$4::text))`,
          [user.id, revoke ? "admin_role_revoked" : "admin_role_granted", user.role, role],
        );
        await pool.query("COMMIT");
        console.log(`Role changed to ${role}. The account's sessions were invalidated; sign in again with Google.`);
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
