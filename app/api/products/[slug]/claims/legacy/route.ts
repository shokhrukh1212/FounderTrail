import { NextResponse } from "next/server";

import { currentUserFromHeaders } from "@/lib/auth";
import { ownerCredentialMatches } from "@/lib/owner-auth";
import { withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/products/[slug]/claims/legacy">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === "string" && body.token.length <= 1024 ? body.token : null;
  if (!token) return NextResponse.json({ error: "Invalid proof." }, { status: 400 });
  try {
    const result = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, { action: "legacy-claim", keyHash: eventHash("legacy-claim:user", user.id), limit: 10, windowSeconds: 3600 });
      if (!allowed) throw new Error("RATE_LIMITED");
      const rows = await client.query<{ id: string; token_hash: string; token_version: number; approved_at: Date | null }>(`SELECT p.id::text,p.approved_at,o.token_hash,o.token_version FROM products p JOIN product_owner_credentials o ON o.product_id=p.id WHERE p.slug=$1 FOR UPDATE OF p`, [slug]);
      const product = rows.rows[0];
      if (!product || !ownerCredentialMatches({ productId: product.id, tokenHash: product.token_hash, tokenVersion: product.token_version, approvedAt: product.approved_at }, token)) return "invalid" as const;
      const owners = await client.query<{ user_id: string }>(`SELECT user_id FROM product_owners WHERE product_id=$1::uuid FOR UPDATE`, [product.id]);
      if (owners.rows[0]) return owners.rows[0].user_id === user.id ? "owned" as const : "conflict" as const;
      const claim = await client.query<{ id: string }>(`INSERT INTO product_claims(product_id,requester_id,state,evidence_method,evidence,reviewed_at) VALUES($1::uuid,$2,'claimed','legacy_owner_token',jsonb_build_object('source','pre-account management credential'),now()) RETURNING id::text`, [product.id, user.id]);
      await client.query(`INSERT INTO product_owners(product_id,user_id,ownership_role,verified_at,verification_method) VALUES($1::uuid,$2,'owner',now(),'legacy_owner_token')`, [product.id, user.id]);
      await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,claim_id) VALUES($1,'user','product.claim.legacy_proof',$2::uuid,$3::uuid)`, [user.id, product.id, claim.rows[0].id]);
      return "claimed" as const;
    });
    if (result === "invalid") return NextResponse.json({ error: "Invalid or rotated proof." }, { status: 401 });
    if (result === "conflict") return NextResponse.json({ error: "This product already has an owner." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") return NextResponse.json({ error: "Too many proof attempts. Try again later." }, { status: 429 });
    return NextResponse.json({ error: "Could not complete the claim." }, { status: 500 });
  }
}
