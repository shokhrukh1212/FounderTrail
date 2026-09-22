import { createHash, randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { currentUserFromHeaders } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { faultBody, reportServerError } from "@/lib/observability";
import { consumeRateLimit } from "@/lib/rate-limit";
import { networkBlockHash, requestOriginIsSameSite } from "@/lib/request-security";

const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Domain proof is the strong path, but it must never be the only path: a founder who
 * cannot publish a file on the domain still needs a way in. Asking for manual review
 * records the same pending claim with `manual_admin` evidence and no challenge, so it
 * reaches the administrator queue instead of dead-ending.
 */
async function requestedMethod(request: Request): Promise<"domain_file" | "manual_review"> {
  try {
    const body = (await request.json()) as { method?: unknown };
    return body?.method === "manual_review" ? "manual_review" : "domain_file";
  } catch {
    return "domain_file";
  }
}

export async function POST(request: Request, context: RouteContext<"/api/products/[slug]/claims">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { slug } = await context.params;
  const asked = await requestedMethod(request);
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
      const products = await client.query<{ id: string; normalized_domain: string | null }>(
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

      // A listing with no normalized domain cannot be proved by file, so it falls back
      // rather than offering a challenge that could never succeed.
      const manual = asked === "manual_review" || !product.normalized_domain;
      const competing = owned.rows.length > 0;
      // `evidence` is merged, not replaced, so the `source` recorded when the listing was
      // first submitted survives a later claim attempt.
      const evidence = manual
        ? `jsonb_build_object('competing_owner',$1::boolean,'manual_review_requested',true)`
        : `jsonb_build_object('competing_owner',$1::boolean)`;
      const method = manual ? "manual_admin" : "domain_file";
      const challengeHash = manual ? null : tokenHash;
      const challengeExpiry = manual ? null : expiresAt;

      const saved = pending.rows[0]
        ? await client.query<{ id: string }>(
            `UPDATE product_claims SET evidence_method=$2,challenge_token_hash=$3,challenge_expires_at=$4,
                    evidence=evidence || ${evidence},updated_at=now() WHERE id=$5::uuid RETURNING id::text`,
            [competing, method, challengeHash, challengeExpiry, pending.rows[0].id],
          )
        : await client.query<{ id: string }>(
            `INSERT INTO product_claims(product_id,requester_id,evidence_method,challenge_token_hash,challenge_expires_at,evidence)
             VALUES($2::uuid,$3,$4,$5,$6,${evidence}) RETURNING id::text`,
            [competing, product.id, user.id, method, challengeHash, challengeExpiry],
          );
      return { id: saved.rows[0].id, domain: product.normalized_domain, manual };
    });
    if (!claim) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    if (claim.manual) {
      return NextResponse.json({
        claimId: claim.id,
        method: "manual_review" as const,
        state: "pending" as const,
      }, { status: 201, headers: { "cache-control": "no-store" } });
    }
    return NextResponse.json({
      claimId: claim.id,
      method: "domain_file" as const,
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
    const correlationId = reportServerError("claim.start", error, { slug, method: asked });
    return NextResponse.json(faultBody("Could not start the claim.", correlationId), { status: 500 });
  }
}
