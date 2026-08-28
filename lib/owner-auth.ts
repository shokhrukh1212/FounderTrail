import "server-only";
import { approvalAccessMatches } from "./approval-access";
import { config } from "./config";
import { query } from "./db";
import { ownerTokenFromRequest, tokenHashMatches } from "./bidindex-owner";

export type OwnerAuth = { productId: string; slug: string; tokenHash: string };
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
  if (!product || !ownerCredentialMatches({ productId: product.id, tokenHash: product.token_hash, tokenVersion: product.token_version, approvedAt: product.approved_at }, ownerTokenFromRequest(request, product.id))) return null;
  return { productId: product.id, slug: product.slug, tokenHash: product.token_hash };
}
