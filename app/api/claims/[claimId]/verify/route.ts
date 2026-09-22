import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { currentUserFromHeaders } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { networkBlockHash, requestOriginIsSameSite } from "@/lib/request-security";
import { fetchPinnedHttpsText } from "@/lib/safe-fetch";

function sameHash(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex"); const b = Buffer.from(right, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request, context: RouteContext<"/api/claims/[claimId]/verify">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { claimId } = await context.params;
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return NextResponse.json({ error: "The verification token is invalid." }, { status: 400 });
  const rows = await query<{ product_id: string; normalized_domain: string; challenge_token_hash: string; challenge_expires_at: Date }>(
    `SELECT pc.product_id::text,p.normalized_domain,pc.challenge_token_hash,pc.challenge_expires_at
       FROM product_claims pc JOIN products p ON p.id=pc.product_id
      WHERE pc.id=$1::uuid AND pc.requester_id=$2 AND pc.state='pending'`, [claimId, user.id],
  ).catch(() => []);
  const claim = rows[0];
  if (!claim) return NextResponse.json({ error: "This claim is unavailable or already completed." }, { status: 404 });
  if (claim.challenge_expires_at.getTime() <= Date.now()) return NextResponse.json({ error: "This challenge expired. Start a fresh claim." }, { status: 410 });
  const presentedHash = createHash("sha256").update(token).digest("hex");
  if (!sameHash(claim.challenge_token_hash, presentedHash)) return NextResponse.json({ error: "The verification token is invalid." }, { status: 400 });
  let text: string;
  try { text = await fetchPinnedHttpsText(claim.normalized_domain, "/.well-known/foundertrail-claim.txt"); }
  catch { return NextResponse.json({ error: "We could not read the HTTPS verification file yet." }, { status: 422 }); }
  if (!text.split(/\r?\n/).map((line) => line.trim()).includes(`foundertrail-claim=${token}`)) {
    return NextResponse.json({ error: "The file was found, but it did not contain this claim token." }, { status: 422 });
  }
  try {
    const outcome=await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, { action: "claim-verify", keyHash: networkBlockHash(request, "claim-verify"), limit: 20, windowSeconds: 3600 });
      if (!allowed) throw new Error("RATE_LIMITED");
      const locked = await client.query<{ product_id: string; challenge_token_hash: string; challenge_expires_at: Date }>(
        `SELECT product_id::text,challenge_token_hash,challenge_expires_at FROM product_claims
          WHERE id=$1::uuid AND requester_id=$2 AND state='pending' FOR UPDATE`, [claimId, user.id],
      );
      const current = locked.rows[0];
      if (!current || current.challenge_expires_at.getTime() <= Date.now() || !sameHash(current.challenge_token_hash, presentedHash)) throw new Error("CLAIM_CHANGED");
      const owner = await client.query(`SELECT 1 FROM product_owners WHERE product_id=$1::uuid FOR UPDATE`, [current.product_id]);
      if (owner.rowCount){await client.query(`UPDATE product_claims SET state='disputed',challenge_token_hash=NULL,challenge_expires_at=NULL,evidence=jsonb_build_object('domain',$1,'path','/.well-known/foundertrail-claim.txt','domain_verified',true,'competing_owner',true),reviewed_at=now(),updated_at=now() WHERE id=$2::uuid`,[claim.normalized_domain,claimId]);await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,claim_id,details) VALUES($1,'user','product.claim.domain_disputed',$2::uuid,$3::uuid,jsonb_build_object('domain',$4))`,[user.id,current.product_id,claimId,claim.normalized_domain]);return "disputed" as const}
      await client.query(
        `INSERT INTO product_owners(product_id,user_id,ownership_role,verified_at,verification_method)
         VALUES($1::uuid,$2,'owner',now(),'domain_file')`, [current.product_id, user.id],
      );
      await client.query(
        `UPDATE product_claims SET state='claimed',challenge_token_hash=NULL,challenge_expires_at=NULL,
                evidence=jsonb_build_object('domain',$1,'path','/.well-known/foundertrail-claim.txt'),reviewed_at=now(),updated_at=now()
          WHERE id=$2::uuid`, [claim.normalized_domain, claimId],
      );
      await client.query(
        `INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,claim_id,details)
         VALUES($1,'user','product.claim.domain_verified',$2::uuid,$3::uuid,jsonb_build_object('domain',$4))`,
        [user.id, current.product_id, claimId, claim.normalized_domain],
      );
      return "claimed" as const;
    });
    return NextResponse.json({ ok: true,disputed:outcome==="disputed" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "RATE_LIMITED") return NextResponse.json({ error: "Too many checks. Try again later." }, { status: 429 });
    if (code === "CLAIM_CHANGED") return NextResponse.json({ error: "This claim changed or expired. Start again." }, { status: 409 });
    console.error("claim verification failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not complete the claim." }, { status: 500 });
  }
}
