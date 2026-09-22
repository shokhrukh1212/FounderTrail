import "server-only";
import { config } from "./config";
import { query } from "./db";
import { decodeEntities } from "./display-text";
import type { PricingBasis, PricingModel, ProductPricing } from "./product-pricing";

export type ProductCommunityState = {
  useCase: string | null;
  intendedAudience: string | null;
  /** Only ever what a founder or admin supplied; never inferred. */
  pricing: ProductPricing;
  isOpenSource: boolean;
  commentCount: number;
  followerCount: number;
  followed: boolean;
  allTimeUpvotes: number;
  outboundClicks: number;
  upvoted: boolean;
  isOwner: boolean;
  ownershipState: "claimed" | "pending" | "disputed" | "unclaimed";
  launch: null | {
    id: string;
    votes: number;
    voted: boolean;
    startsAt: Date;
    endsAt: Date;
    active: boolean;
  };
};

export type ProductComment = {
  id: string;
  parentId: string | null;
  body: string;
  authorName: string;
  authorImage: string | null;
  isFounder: boolean;
  isAuthor: boolean;
  editedAt: Date | null;
  createdAt: Date;
};

export type ConnectedMetric = {
  type: "revenue_30d" | "mrr";
  currency: string;
  valueMinor: number;
  periodStart: Date | null;
  periodEnd: Date;
  refreshedAt: Date;
  stale: boolean;
};

export async function getProductCommunityState(productId: string, userId: string | null): Promise<ProductCommunityState> {
  const rows = await query<{
    use_case: string | null;
    intended_audience: string | null;
    pricing_model: PricingModel | null;
    starting_price_minor: string | null;
    pricing_currency: string | null;
    pricing_basis: PricingBasis | null;
    pricing_unit: string | null;
    pricing_per_seat: boolean;
    is_open_source: boolean;
    comment_count: number;
    follower_count: number;
    followed: boolean;
    all_time_upvotes: number;
    outbound_clicks: number;
    upvoted: boolean;
    is_owner: boolean;
    ownership_state: "claimed" | "pending" | "disputed" | "unclaimed";
    launch_id: string | null;
    launch_votes: number;
    launch_voted: boolean;
    starts_at: Date | null;
    ends_at: Date | null;
    launch_active: boolean | null;
  }>(
    `SELECT p.use_case,p.intended_audience,p.pricing_model,p.starting_price_minor::text,p.pricing_currency,
            p.pricing_basis,p.pricing_unit,p.pricing_per_seat,p.is_open_source,
            (SELECT count(*)::int FROM product_comments pcm WHERE pcm.product_id=p.id AND pcm.hidden_at IS NULL) AS comment_count,
            (SELECT count(*)::int FROM product_follows f WHERE f.product_id=p.id) AS follower_count,
            CASE WHEN $2::text IS NULL THEN false ELSE EXISTS(
              SELECT 1 FROM product_follows f WHERE f.product_id=p.id AND f.user_id=$2
            ) END AS followed,
            (SELECT count(*)::int FROM product_votes pv WHERE pv.product_id=p.id AND pv.active AND (p.is_demo OR NOT pv.is_demo)) AS all_time_upvotes,
            (SELECT count(*)::int FROM product_outbound_click_events oce WHERE oce.product_id=p.id AND oce.outcome='counted') AS outbound_clicks,
            CASE WHEN $2::text IS NULL THEN false ELSE EXISTS(
              SELECT 1 FROM product_votes pv WHERE pv.product_id=p.id AND pv.user_id=$2 AND pv.active
            ) END AS upvoted,
            CASE WHEN $2::text IS NULL THEN false ELSE EXISTS(
              SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2
            ) END AS is_owner,
            CASE WHEN $2::text IS NOT NULL AND EXISTS(
                   SELECT 1 FROM product_claims pc WHERE pc.product_id=p.id AND pc.requester_id=$2 AND pc.state='disputed'
                 ) THEN 'disputed'
                 WHEN EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id) THEN 'claimed'
                 WHEN EXISTS(SELECT 1 FROM product_claims pc WHERE pc.product_id=p.id AND pc.state='pending') THEN 'pending'
                 ELSE 'unclaimed' END AS ownership_state,
            pl.id::text AS launch_id,
            CASE WHEN pl.id IS NULL THEN 0 ELSE (SELECT count(*)::int FROM launch_votes lv WHERE lv.launch_id=pl.id AND lv.active) END AS launch_votes,
            CASE WHEN pl.id IS NULL OR $2::text IS NULL THEN false ELSE EXISTS(
              SELECT 1 FROM launch_votes lv WHERE lv.launch_id=pl.id AND lv.user_id=$2 AND lv.active
            ) END AS launch_voted,
            lw.starts_at,lw.ends_at,
            CASE WHEN lw.id IS NULL THEN false ELSE lw.starts_at<=now() AND now()<lw.ends_at AND pl.state IN ('scheduled','active') END AS launch_active
       FROM products p
       LEFT JOIN product_launches pl ON pl.product_id=p.id AND pl.state IN ('scheduled','active','completed')
       LEFT JOIN launch_weeks lw ON lw.id=pl.launch_week_id
      WHERE p.id=$1::uuid
      ORDER BY lw.starts_at DESC NULLS LAST LIMIT 1`,
    [productId, userId],
  );
  const row = rows[0];
  if (!row) throw new Error("PRODUCT_NOT_FOUND");
  return {
    useCase: row.use_case === null ? null : decodeEntities(row.use_case),
    intendedAudience: row.intended_audience === null ? null : decodeEntities(row.intended_audience),
    pricing: {
      model: row.pricing_model,
      startingPriceMinor: row.starting_price_minor === null ? null : Number(row.starting_price_minor),
      currency: row.pricing_currency,
      basis: row.pricing_basis,
      unit: row.pricing_unit,
      perSeat: row.pricing_per_seat,
    },
    isOpenSource: row.is_open_source,
    commentCount: Number(row.comment_count),
    followerCount: Number(row.follower_count),
    followed: row.followed,
    allTimeUpvotes: Number(row.all_time_upvotes),
    outboundClicks: Number(row.outbound_clicks),
    upvoted: row.upvoted,
    isOwner: row.is_owner,
    ownershipState: row.ownership_state,
    launch: row.launch_id && row.starts_at && row.ends_at ? {
      id: row.launch_id,
      votes: Number(row.launch_votes),
      voted: row.launch_voted,
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
      active: Boolean(row.launch_active),
    } : null,
  };
}

export async function getProductComments(productId: string, userId: string | null): Promise<ProductComment[]> {
  const rows = await query<{
    id: string;
    parent_id: string | null;
    body: string;
    author_name: string;
    author_image: string | null;
    is_founder: boolean;
    is_author: boolean;
    edited_at: Date | null;
    created_at: Date;
  }>(
    `SELECT c.id::text,c.parent_id::text,c.body,u.name AS author_name,u.image AS author_image,
            EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=c.product_id AND po.user_id=c.author_id) AS is_founder,
            ($2::text IS NOT NULL AND c.author_id=$2) AS is_author,c.edited_at,c.created_at
       FROM product_comments c JOIN app_users u ON u.id=c.author_id
      WHERE c.product_id=$1::uuid AND c.hidden_at IS NULL
      ORDER BY coalesce(c.parent_id,c.id),c.parent_id NULLS FIRST,c.created_at,c.id`,
    [productId, userId],
  );
  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    body: row.body,
    authorName: row.author_name,
    authorImage: row.author_image,
    isFounder: row.is_founder,
    isAuthor: row.is_author,
    editedAt: row.edited_at ? new Date(row.edited_at) : null,
    createdAt: new Date(row.created_at),
  }));
}

export async function getPublishedConnectedMetrics(productId: string): Promise<ConnectedMetric[]> {
  // One gate for the whole public surface: the product page section, its subnav link
  // and anything else reading published metrics all go through here.
  if (!config.founderMetricsEnabled) return [];
  const rows = await query<{
    metric_type: "revenue_30d" | "mrr";
    currency: string;
    value_minor: string;
    period_start: Date | null;
    period_end: Date;
    last_synced_at: Date;
  }>(
    `SELECT DISTINCT ON (s.metric_type,s.currency) s.metric_type,s.currency,s.value_minor::text,
            s.period_start,s.period_end,c.last_synced_at
       FROM metric_connections c JOIN metric_snapshots s ON s.connection_id=c.id
      WHERE c.product_id=$1::uuid AND c.status IN ('active','stale') AND c.disconnected_at IS NULL
        AND ((s.metric_type='revenue_30d' AND c.publish_revenue) OR (s.metric_type='mrr' AND c.publish_mrr))
      ORDER BY s.metric_type,s.currency,s.period_end DESC,s.id DESC`,
    [productId],
  );
  return rows.map((row) => ({
    type: row.metric_type,
    currency: row.currency,
    valueMinor: Number(row.value_minor),
    periodStart: row.period_start ? new Date(row.period_start) : null,
    periodEnd: new Date(row.period_end),
    refreshedAt: new Date(row.last_synced_at),
    stale: Date.now() - new Date(row.last_synced_at).getTime() > 48 * 60 * 60 * 1000,
  }));
}
