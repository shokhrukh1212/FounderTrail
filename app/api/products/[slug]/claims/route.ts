import { createHash, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { currentUserFromHeaders } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rate-limit";
import { networkBlockHash, requestOriginIsSameSite } from "@/lib/request-security";

const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: Request, context: RouteContext<"/api/products/[slug]/claims">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const token = randomBytes(24).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
  try {
    const claim = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, {
        action: "product-claim",
        keyHash: networkBlockHash(request, "product-claim"),
        limit: 10,
        windowSeconds: 3600,
      });
      if (!allowed) throw new Error("RATE_LIMITED");
      const products = await client.query<{ id: string; normalized_domain: string }>(
        `SELECT id::text,normalized_domain FROM products WHERE slug=$1 AND (status='published' OR created_by_user_id=$2) FOR UPDATE`, [slug, user.id],
      );
      const product = products.rows[0];
      if (!product) return null;
      const owned = await client.query<{user_id:string}>(`SELECT user_id FROM product_owners WHERE product_id=$1::uuid FOR UPDATE`, [product.id]);
      if(owned.rows.some(item=>item.user_id===user.id))throw new Error("ALREADY_CLAIMED");
      const existingDispute=await client.query(`SELECT 1 FROM product_claims WHERE product_id=$1::uuid AND requester_id=$2 AND state='disputed'`,[product.id,user.id]);
      if(existingDispute.rowCount)throw new Error("DISPUTE_PENDING");
      const pending = await client.query<{ id: string; requester_id: string }>(
        `SELECT id::text,requester_id FROM product_claims WHERE product_id=$1::uuid AND state='pending' FOR UPDATE`, [product.id],
      );
      if (pending.rows[0] && pending.rows[0].requester_id !== user.id) throw new Error("CLAIM_PENDING");
      const saved = pending.rows[0]
        ? await client.query<{ id: string }>(
            `UPDATE product_claims SET evidence_method='domain_file',challenge_token_hash=$1,challenge_expires_at=$2,
                    evidence=jsonb_build_object('competing_owner',$3),updated_at=now() WHERE id=$4::uuid RETURNING id::text`,
            [tokenHash, expiresAt,owned.rows.length>0, pending.rows[0].id],
          )
        : await client.query<{ id: string }>(
            `INSERT INTO product_claims(product_id,requester_id,evidence_method,challenge_token_hash,challenge_expires_at,evidence)
             VALUES($1::uuid,$2,'domain_file',$3,$4,jsonb_build_object('competing_owner',$5)) RETURNING id::text`,
            [product.id, user.id, tokenHash, expiresAt,owned.rows.length>0],
          );
      return { id: saved.rows[0].id, domain: product.normalized_domain };
    });
    if (!claim) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    return NextResponse.json({
      claimId: claim.id,
      fileUrl: `https://${claim.domain}/.well-known/foundertrail-claim.txt`,
      fileContents: `foundertrail-claim=${token}`,
      expiresAt: expiresAt.toISOString(),
    }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "RATE_LIMITED") return NextResponse.json({ error: "Too many claim attempts. Try again later." }, { status: 429 });
    if (code === "ALREADY_CLAIMED") return NextResponse.json({ error: "This product already has a verified owner." }, { status: 409 });
    if (code === "DISPUTE_PENDING") return NextResponse.json({ error: "Your competing ownership claim is waiting for administrator review." }, { status: 409 });
    if (code === "CLAIM_PENDING") return NextResponse.json({ error: "A claim is already being reviewed for this product." }, { status: 409 });
    console.error("claim creation failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not start the claim." }, { status: 500 });
  }
}
