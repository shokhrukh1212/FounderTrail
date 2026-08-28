import type { PoolClient } from "pg";
import { isObviousBot } from "./click";
import { withTransaction } from "./db";
import { ownerTokenFromRequest } from "./bidindex-owner";
import { ownerCredentialMatches } from "./owner-auth";
import { ensureBidIndexVisitor } from "./bidindex-visitor";
import { networkHash } from "./request-security";
import { publicHttpUrl } from "./product-validation";

export type ProductClickOutcome = "counted" | "duplicate" | "bot" | "owner" | "rate_limited" | "not_found" | "error";

async function insertOutcome(client: PoolClient, input: { productId: string; visitorHash: string; networkHash: string; outcome: ProductClickOutcome; source: "product" | "badge" }) {
  await client.query(`INSERT INTO product_outbound_click_events (product_id, visitor_hash, network_hash, outcome, source) VALUES ($1::uuid,$2,$3,$4,$5)`, [input.productId, input.visitorHash, input.networkHash, input.outcome, input.source]);
}

export async function recordProductClick(request: Request, slug: string) {
  const source = "product" as const;
  const visitor = ensureBidIndexVisitor(request);
  return withTransaction(async (client) => {
    const products = await client.query<{ id: string; website_url: string; approved_at: Date | null; token_hash: string; token_version: number }>(
      `SELECT p.id::text,p.website_url,p.approved_at,o.token_hash,o.token_version FROM products p JOIN product_owner_credentials o ON o.product_id=p.id WHERE p.slug=$1 AND p.status='published' AND ($2::boolean OR NOT p.is_demo) LIMIT 1`, [slug,process.env.NODE_ENV!=="production"]);
    const product = products.rows[0];
    if (!product) return { destination: null, visitor, outcome: "not_found" as const };
    const destination = publicHttpUrl(product.website_url);
    if (!destination.ok) return { destination: null, visitor, outcome: "error" as const };
    const requestNetworkHash = networkHash(request, "outbound-click");
    const ownerToken = ownerTokenFromRequest(request, product.id);
    if (ownerCredentialMatches({ productId: product.id, tokenHash: product.token_hash, tokenVersion: product.token_version, approvedAt: product.approved_at }, ownerToken)) {
      await insertOutcome(client, { productId: product.id, visitorHash: visitor.hash, networkHash: requestNetworkHash, outcome: "owner", source });
      return { destination: destination.url, visitor, outcome: "owner" as const };
    }
    if (isObviousBot(request)) {
      await insertOutcome(client, { productId: product.id, visitorHash: visitor.hash, networkHash: requestNetworkHash, outcome: "bot", source });
      return { destination: destination.url, visitor, outcome: "bot" as const };
    }
    const recent = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM product_outbound_click_events WHERE network_hash = $1 AND created_at >= now() - interval '10 minutes'`, [requestNetworkHash]);
    if (Number(recent.rows[0]?.count ?? 0) >= 20) {
      await insertOutcome(client, { productId: product.id, visitorHash: visitor.hash, networkHash: requestNetworkHash, outcome: "rate_limited", source });
      return { destination: destination.url, visitor, outcome: "rate_limited" as const };
    }
    const counted = await client.query(
      `INSERT INTO product_outbound_click_events (product_id, visitor_hash, network_hash, outcome, source)
       VALUES ($1::uuid,$2,$3,'counted',$4) ON CONFLICT (product_id, visitor_hash) WHERE outcome = 'counted' DO NOTHING RETURNING id`,
      [product.id, visitor.hash, requestNetworkHash, source]);
    if (!counted.rowCount) {
      await insertOutcome(client, { productId: product.id, visitorHash: visitor.hash, networkHash: requestNetworkHash, outcome: "duplicate", source });
      return { destination: destination.url, visitor, outcome: "duplicate" as const };
    }
    await client.query(
      `INSERT INTO product_metric_aggregates (product_id, metric_type, source, currency, value, last_event_at)
       VALUES ($1::uuid,'outbound_clicks','measured_by_bidindex','',1,now())
       ON CONFLICT (product_id, metric_type, source, currency) DO UPDATE SET value = product_metric_aggregates.value + 1, last_event_at = now(), updated_at = now()`,
      [product.id]);
    return { destination: destination.url, visitor, outcome: "counted" as const };
  });
}
