import "server-only";
import { query } from "./db";
import { ownerTokenFromRequest, tokenHashMatches } from "./bidindex-owner";

export type OwnerAuth = { productId: string; slug: string; tokenHash: string };

export async function authenticateOwner(request: Request, slug: string): Promise<OwnerAuth | null> {
  const rows = await query<{ id: string; slug: string; token_hash: string }>(
    `SELECT p.id::text, p.slug, o.token_hash FROM products p JOIN product_owner_credentials o ON o.product_id = p.id WHERE p.slug = $1 LIMIT 1`, [slug]);
  const product = rows[0];
  if (!product || !tokenHashMatches(product.token_hash, ownerTokenFromRequest(request, product.id))) return null;
  return { productId: product.id, slug: product.slug, tokenHash: product.token_hash };
}
