import "server-only";
import { query } from "./db";

/**
 * What an existing listing on the same domain means for the person submitting.
 *
 * Only a published listing is named. A draft or a submission under review belongs to
 * someone else's private pipeline, so the founder is told it exists without learning the
 * product's name, slug or owner.
 */
export type DomainDuplicate = {
  kind: "published" | "own_draft" | "under_review";
  slug: string | null;
  name: string | null;
  message: string;
};

const MESSAGES = {
  published: "A startup from this domain is already listed. Claim it, or confirm this is a distinct product on the same domain.",
  own_draft: "You already have a draft or submission for this domain. Continue it from My products.",
  under_review: "A submission for this domain is already under review.",
} as const;

export async function findDomainDuplicate(normalizedDomain: string, userId: string | null): Promise<DomainDuplicate | null> {
  const rows = await query<{ slug: string; name: string; status: string; created_by_user_id: string | null }>(
    `SELECT slug,name,status,created_by_user_id FROM products
      WHERE normalized_domain=$1 AND status IN ('draft','pending','published')
      ORDER BY CASE status WHEN 'published' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,created_at LIMIT 1`,
    [normalizedDomain],
  );
  const duplicate = rows[0];
  if (!duplicate) return null;
  if (duplicate.status === "published") {
    return { kind: "published", slug: duplicate.slug, name: duplicate.name, message: MESSAGES.published };
  }
  const own = Boolean(userId) && duplicate.created_by_user_id === userId;
  return own
    ? { kind: "own_draft", slug: null, name: null, message: MESSAGES.own_draft }
    : { kind: "under_review", slug: null, name: null, message: MESSAGES.under_review };
}
