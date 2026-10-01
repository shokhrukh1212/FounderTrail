import "server-only";
import { approvalAccessMatches } from "./approval-access";
import { config } from "./config";
import { query, withTransaction } from "./db";
import { associateOriginalSubmitter } from "./management-access";
import { tokenHashMatches } from "./bidindex-owner";
import { currentUserFromHeaders } from "./auth";

export type OwnerAuth = { productId: string; slug: string; tokenHash: string; userId: string };
export type OwnerCredential = { productId: string; tokenHash: string; tokenVersion: number; approvedAt: Date | null };

export function ownerCredentialMatches(credential: OwnerCredential, token: string | null): boolean {
  if (tokenHashMatches(credential.tokenHash, token)) return true;
  return credential.approvedAt !== null && approvalAccessMatches(token, {
    productId: credential.productId,
    approvedAt: credential.approvedAt,
    tokenVersion: credential.tokenVersion,
  }, config.eventHashSalt);
}

export async function authenticateOwner(request: Request, slug: string): Promise<OwnerAuth | null> {
  const rows = await query<{ id: string; slug: string; token_hash: string; token_version: number; approved_at: Date | null }>(
    `SELECT p.id::text,p.slug,p.approved_at,o.token_hash,o.token_version FROM products p JOIN product_owner_credentials o ON o.product_id=p.id WHERE p.slug=$1 LIMIT 1`, [slug]);
  const product = rows[0];
  if (!product) return null;
  const user = await currentUserFromHeaders(request.headers).catch(() => null);
  if (user) {
    // Admins can open every product's workspace, as its founder would.
    if (user.role === "admin") return { productId: product.id, slug: product.slug, tokenHash: product.token_hash, userId: user.id };
    const ownership = await query<{ allowed: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM product_owners WHERE product_id=$1::uuid AND user_id=$2) AS allowed`,
      [product.id, user.id],
    );
    if (ownership[0]?.allowed) return { productId: product.id, slug: product.slug, tokenHash: product.token_hash, userId: user.id };
    const associated = await withTransaction(async client => {
      await client.query(`SELECT id FROM products WHERE id=$1::uuid FOR UPDATE`, [product.id]);
      return associateOriginalSubmitter(client, product.id, user.id);
    });
    if (associated) return { productId: product.id, slug: product.slug, tokenHash: product.token_hash, userId: user.id };
  }
  return null;
}
