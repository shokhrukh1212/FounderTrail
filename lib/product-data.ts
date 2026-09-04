import "server-only";
import { query } from "./db";

export const DISCOVERY_VIEWS = ["today", "trending", "verified", "newest"] as const;
export type DiscoveryView = (typeof DISCOVERY_VIEWS)[number];
export type ProductStatus = "draft" | "pending" | "published" | "rejected" | "archived";
export type MetricSource = "measured_by_bidindex" | "processor_verified" | "partner_connected" | "publicly_sourced" | "founder_reported";
export type MetricType = "visitors" | "revenue" | "outbound_clicks" | "bids" | "purchases" | "refunds" | "current_bid" | "highest_bid" | "partner_product_clicks";

export type ProductMetric = {
  type: MetricType;
  source: MetricSource;
  currency: string;
  value: number;
  sourceUrl: string | null;
  updatedAt: Date;
  lastEventAt: Date | null;
  measurementPeriod: "all_time" | "today" | "last_30_days";
};

export type ProductCardData = {
  id: string;
  slug: string;
  websiteUrl: string;
  name: string;
  tagline: string;
  launchAt: Date;
  publishedAt: Date;
  isDemo: boolean;
  logoUrl: string | null;
  categories: Array<{ slug: string; name: string }>;
  voteCount: number;
  weeklyVotes: number;
  weeklyClicks: number;
  totalClicks: number;
  updateCount: number;
  metrics: ProductMetric[];
  isVerified: boolean;
};

type ProductCardRow = {
  id: string;
  slug: string;
  website_url: string;
  name: string;
  tagline: string;
  launch_at: Date;
  published_at: Date;
  is_demo: boolean;
  logo_url: string | null;
  categories: Array<{ slug: string; name: string }> | null;
  vote_count: number;
  weekly_votes: number;
  weekly_clicks: number;
  total_clicks: number;
  update_count: number;
  metrics: Array<{
    type: MetricType;
    source: MetricSource;
    currency: string;
    value: string | number;
    sourceUrl: string | null;
    updatedAt: string;
    lastEventAt: string | null;
    measurementPeriod: "all_time" | "today" | "last_30_days";
  }> | null;
  product_verified_at: Date | null;
};

const CARD_COLUMNS = `
  p.id::text, p.slug, p.website_url, p.name, p.tagline, p.launch_at,
  p.published_at, p.is_demo,
  (SELECT i.product_verified_at FROM product_integrations i WHERE i.product_id=p.id) AS product_verified_at,
  COALESCE(
    (SELECT pm.public_url FROM product_media pm
      WHERE pm.product_id = p.id AND pm.kind = 'logo' LIMIT 1),
    (SELECT '/api/products/' || p.slug || '/logo' FROM product_submission_metadata sm
      WHERE sm.product_id = p.id LIMIT 1)
  ) AS logo_url,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name))
    FROM categories c WHERE c.id = p.primary_category_id),
    (SELECT jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name) ORDER BY pc.position)
      FROM product_categories pc JOIN categories c ON c.id = pc.category_id
      WHERE pc.product_id = p.id), '[]'::jsonb) AS categories,
  (SELECT count(*)::int FROM product_votes v
    WHERE v.product_id = p.id AND v.active AND (p.is_demo OR NOT v.is_demo)) AS vote_count,
  (SELECT count(*)::int FROM product_votes v
    WHERE v.product_id = p.id AND v.active AND v.first_upvoted_at >= now() - interval '7 days'
      AND (p.is_demo OR NOT v.is_demo)) AS weekly_votes,
  (SELECT count(*)::int FROM product_outbound_click_events oce
    WHERE oce.product_id = p.id AND oce.outcome = 'counted'
      AND oce.created_at >= now() - interval '7 days') AS weekly_clicks,
  (SELECT count(*)::int FROM product_outbound_click_events oce
    WHERE oce.product_id = p.id AND oce.outcome = 'counted') AS total_clicks,
  (SELECT count(*)::int FROM product_updates pu WHERE pu.product_id = p.id) AS update_count,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'type', a.metric_type, 'source', a.source, 'currency', a.currency,
      'value', a.value::text, 'sourceUrl', a.source_url,
      'updatedAt', a.updated_at, 'lastEventAt', a.last_event_at, 'measurementPeriod', a.measurement_period)
    ORDER BY CASE a.source WHEN 'measured_by_bidindex' THEN 1 WHEN 'processor_verified' THEN 2
      WHEN 'partner_connected' THEN 3 WHEN 'publicly_sourced' THEN 4 ELSE 5 END, a.metric_type, a.currency)
    FROM (
      SELECT metric_type,source,currency,
             CASE WHEN metric_type='highest_bid' THEN max(value)
                  WHEN metric_type='current_bid' THEN (array_agg(value ORDER BY updated_at DESC))[1]
                  ELSE sum(value) END AS value,
             max(source_url) AS source_url,max(updated_at) AS updated_at,max(last_event_at) AS last_event_at,
             (array_agg(measurement_period ORDER BY updated_at DESC))[1] AS measurement_period
        FROM (
          SELECT metric_type,
                 CASE WHEN source='verified_by_bidindex' THEN 'measured_by_bidindex'
                      WHEN source='verified_live' AND metric_type='visitors' THEN 'measured_by_bidindex'
                      WHEN source='verified_live' THEN 'partner_connected' ELSE source END AS source,
                 currency,value,source_url,updated_at,last_event_at,measurement_period
            FROM product_metric_aggregates stored
           WHERE stored.product_id=p.id AND stored.source_status='active'
             AND NOT (stored.metric_type='visitors' AND stored.source IN ('measured_by_bidindex','verified_live')
               AND EXISTS (SELECT 1 FROM product_traffic_daily td WHERE td.product_id=p.id))
        ) normalized
       GROUP BY metric_type,source,currency
      UNION ALL
      SELECT 'visitors','measured_by_bidindex','',sum(td.daily_uniques),NULL,max(td.updated_at),max(td.updated_at),'last_30_days'
        FROM product_traffic_daily td
       WHERE td.product_id=p.id AND td.metric_date >= (now() AT TIME ZONE 'UTC')::date - 29
       HAVING sum(td.daily_uniques)>0
    ) a), '[]'::jsonb) AS metrics
`;

/**
 * All-time, not weekly. A seven-day window said almost nothing while most products were
 * days old, and it quietly reshuffled the board every night. Upvotes lead, eligible
 * outbound clicks break ties, then the newer launch.
 */
const ORDER: Record<DiscoveryView, string> = {
  today: `vote_count DESC, total_clicks DESC, p.published_at DESC, p.id`,
  trending: `vote_count DESC, total_clicks DESC, p.published_at DESC, p.id`,
  verified: `p.published_at DESC, p.id`,
  newest: `p.published_at DESC, p.id`,
};

function card(row: ProductCardRow): ProductCardData {
  return {
    id: row.id,
    slug: row.slug,
    websiteUrl: row.website_url,
    name: row.name,
    tagline: row.tagline,
    launchAt: new Date(row.launch_at),
    publishedAt: new Date(row.published_at),
    isDemo: row.is_demo,
    logoUrl: row.logo_url,
    categories: row.categories ?? [],
    voteCount: Number(row.vote_count),
    weeklyVotes: Number(row.weekly_votes),
    weeklyClicks: Number(row.weekly_clicks),
    totalClicks: Number(row.total_clicks),
    updateCount: Number(row.update_count),
    metrics: (row.metrics ?? []).map((metric) => ({
      ...metric,
      value: Number(metric.value),
      updatedAt: new Date(metric.updatedAt),
      lastEventAt: metric.lastEventAt ? new Date(metric.lastEventAt) : null,
    })),
    isVerified: row.product_verified_at !== null,
  };
}

export const DISCOVERY_PAGE_SIZE = 30;

export type DiscoveryPage = {
  products: ProductCardData[];
  /** Every published product the current view and search match, not just this page. */
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  /** Rows skipped before this page, so list positions keep counting across pages. */
  offset: number;
};

/** The filters the count and the page share, so the pager can never disagree with the list. */
function discoveryFilters(view: DiscoveryView, search: string): { where: string; params: unknown[] } {
  const filters = [
    `p.status = 'published'`,
    process.env.NODE_ENV === "production" ? `p.is_demo = false` : `true`,
  ];
  const params: unknown[] = [];
  if (view === "today") {
    filters.push(`p.launch_date = (now() AT TIME ZONE 'UTC')::date`);
  }
  if (view === "verified") {
    filters.push(`EXISTS (SELECT 1 FROM product_integrations verified
      WHERE verified.product_id = p.id AND verified.product_verified_at IS NOT NULL)`);
  }
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    const index = params.length;
    filters.push(`(p.name ILIKE $${index} ESCAPE '\\' OR p.tagline ILIKE $${index} ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM product_categories search_pc JOIN categories search_c ON search_c.id = search_pc.category_id
        WHERE search_pc.product_id = p.id AND search_c.name ILIKE $${index} ESCAPE '\\'))`);
  }
  return { where: filters.join(" AND "), params };
}

/**
 * One page of the discovery list together with the totals the header and pager need. The
 * page is clamped into range, so a hand-typed ?page= never renders an empty list while
 * products exist.
 */
export async function getDiscoveryPage(input: {
  view?: string;
  query?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<DiscoveryPage> {
  const view: DiscoveryView = DISCOVERY_VIEWS.includes(input.view as DiscoveryView)
    ? input.view as DiscoveryView
    : "trending";
  const search = (input.query ?? "").trim().slice(0, 80);
  const pageSize = Math.max(1, Math.min(Math.trunc(input.pageSize ?? DISCOVERY_PAGE_SIZE), 50));
  const { where, params } = discoveryFilters(view, search);
  const totals = await query<{ total: number }>(
    `SELECT count(*)::int AS total FROM products p WHERE ${where}`,
    params,
  );
  const total = totals[0]?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const requested = Number.isFinite(input.page) ? Math.trunc(input.page as number) : 1;
  const page = Math.min(Math.max(1, requested), pageCount);
  const offset = (page - 1) * pageSize;
  const rows = await query<ProductCardRow>(
    `SELECT ${CARD_COLUMNS}
       FROM products p
      WHERE ${where}
      ORDER BY ${ORDER[view]}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, offset],
  );
  return { products: rows.map(card), total, page, pageCount, pageSize, offset };
}

export async function getFoundingProducts(): Promise<ProductCardData[]> {
  const rows=await query<ProductCardRow>(`SELECT ${CARD_COLUMNS} FROM products p WHERE p.status='published' AND p.founding_position IS NOT NULL AND ($1::boolean OR NOT p.is_demo) ORDER BY p.founding_position`,[process.env.NODE_ENV!=="production"]);
  return rows.map(card);
}

export type EcosystemSnapshot = {
  products: number;
  verifiedPartners: number;
  revenueByCurrency: Array<{ currency: string; value: number }>;
  outboundClicks: number | null;
};

export async function getEcosystemSnapshot(): Promise<EcosystemSnapshot> {
  const includeDemo = process.env.NODE_ENV !== "production";
  const [counts, revenue] = await Promise.all([
    query<{ products: string; verified: string; clicks: string }>(
      `SELECT count(*)::text AS products,
              count(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM product_integrations i
                 WHERE i.product_id = p.id AND i.product_verified_at IS NOT NULL
              ))::text AS verified,
              COALESCE((SELECT sum(a.value) FROM product_metric_aggregates a
                JOIN products cp ON cp.id = a.product_id
               WHERE a.metric_type = 'outbound_clicks' AND a.source IN ('measured_by_bidindex','verified_by_bidindex')
                 AND cp.status = 'published' AND ($1::boolean OR NOT cp.is_demo)), 0)::text AS clicks
         FROM products p WHERE p.status = 'published' AND ($1::boolean OR NOT p.is_demo)`,
      [includeDemo],
    ),
    query<{ currency: string; value: string }>(
      `SELECT a.currency, sum(a.value)::text AS value
         FROM product_metric_aggregates a JOIN products p ON p.id = a.product_id
        WHERE a.metric_type = 'revenue'
          AND a.source IN ('processor_verified','partner_connected','publicly_sourced','verified_live') AND a.source_status='active'
          AND p.status = 'published' AND ($1::boolean OR NOT p.is_demo)
        GROUP BY a.currency ORDER BY a.currency`,
      [includeDemo],
    ),
  ]);
  return {
    products: Number(counts[0]?.products ?? 0),
    verifiedPartners: Number(counts[0]?.verified ?? 0),
    outboundClicks: Number(counts[0]?.clicks ?? 0) || null,
    revenueByCurrency: revenue.map((row) => ({ currency: row.currency, value: Number(row.value) })),
  };
}

export type LatestUpdate = {
  id: string;
  productSlug: string;
  productName: string;
  type: string;
  title: string;
  publishedAt: Date;
  isDemo: boolean;
};

export async function getLatestUpdates(limit = 3): Promise<LatestUpdate[]> {
  const rows = await query<{
    id: string; product_slug: string; product_name: string; type: string;
    title: string; published_at: Date; is_demo: boolean;
  }>(
    `SELECT u.id::text, p.slug AS product_slug, p.name AS product_name,
            u.type, u.title, u.published_at, p.is_demo
       FROM product_updates u JOIN products p ON p.id = u.product_id
      WHERE p.status = 'published' AND ($2::boolean OR NOT p.is_demo)
      ORDER BY u.published_at DESC, u.id DESC LIMIT $1`,
    [Math.max(1, Math.min(limit, 10)), process.env.NODE_ENV !== "production"],
  );
  return rows.map((row) => ({
    id: row.id,
    productSlug: row.product_slug,
    productName: row.product_name,
    type: row.type,
    title: row.title,
    publishedAt: new Date(row.published_at),
    isDemo: row.is_demo,
  }));
}

export async function getActiveVoteSlugs(voterHash: string | null): Promise<Set<string>> {
  if (!voterHash) return new Set();
  const rows = await query<{ slug: string }>(
    `SELECT p.slug FROM product_votes v JOIN products p ON p.id = v.product_id
      WHERE v.voter_hash = $1 AND v.active AND p.status = 'published'
        AND ($2::boolean OR NOT p.is_demo)`,
    [voterHash, process.env.NODE_ENV !== "production"],
  );
  return new Set(rows.map((row) => row.slug));
}

export async function getMetricLeaderboard(input: {
  metric: MetricType | "upvotes";
  currency?: string;
  limit?: number;
}): Promise<Array<ProductCardData & { leaderboardValue: number; leaderboardSource: MetricSource | "community" }>> {
  if (input.metric === "upvotes") {
    const limit = Math.max(1, Math.min(input.limit ?? 25, 50));
    const rows = await query<ProductCardRow>(
      `SELECT ${CARD_COLUMNS} FROM products p
        WHERE p.status = 'published' AND ($2::boolean OR NOT p.is_demo)
        ORDER BY vote_count DESC, p.published_at DESC, p.id LIMIT $1`,
      [limit, process.env.NODE_ENV !== "production"],
    );
    return rows.map(card).map((item) => ({ ...item, leaderboardValue: item.voteCount, leaderboardSource: "community" as const }));
  }
  const currency = input.currency?.toUpperCase().slice(0, 3) ?? "";
  const limit = Math.max(1, Math.min(input.limit ?? 25, 50));
  const rows = await query<ProductCardRow & { leaderboard_value: string; leaderboard_source: MetricSource }>(
    `SELECT ${CARD_COLUMNS}, ranked.value::text AS leaderboard_value,
            ranked.source AS leaderboard_source
       FROM products p
       JOIN LATERAL (
         SELECT candidate.value,candidate.source FROM (
           SELECT CASE WHEN metric_type='highest_bid' THEN max(value)
                       WHEN metric_type='current_bid' THEN (array_agg(value ORDER BY updated_at DESC))[1]
                       ELSE sum(value) END AS value,source
             FROM (
               SELECT a.metric_type,a.currency,a.value,a.updated_at,
                      CASE WHEN a.source='verified_by_bidindex' THEN 'measured_by_bidindex'
                           WHEN a.source='verified_live' AND a.metric_type='visitors' THEN 'measured_by_bidindex'
                           WHEN a.source='verified_live' THEN 'partner_connected' ELSE a.source END AS source
                 FROM product_metric_aggregates a
                WHERE a.product_id=p.id AND a.metric_type=$1 AND a.source_status='active'
                  AND a.source IN ('measured_by_bidindex','processor_verified','partner_connected','publicly_sourced','verified_by_bidindex','verified_live')
                  AND NOT ($1='visitors' AND a.source IN ('measured_by_bidindex','verified_live')
                    AND EXISTS (SELECT 1 FROM product_traffic_daily td WHERE td.product_id=p.id))
                  AND ($2='' OR a.currency=$2)
             ) normalized
            GROUP BY metric_type,source,currency
           UNION ALL
           SELECT sum(td.daily_uniques),'measured_by_bidindex'
             FROM product_traffic_daily td
            WHERE $1='visitors' AND td.product_id=p.id
              AND td.metric_date >= (now() AT TIME ZONE 'UTC')::date - 29
            HAVING sum(td.daily_uniques)>0
         ) candidate
         ORDER BY CASE candidate.source WHEN 'measured_by_bidindex' THEN 1 WHEN 'processor_verified' THEN 2 WHEN 'partner_connected' THEN 3 ELSE 4 END
         LIMIT 1
       ) ranked ON true
      WHERE p.status = 'published' AND ($4::boolean OR NOT p.is_demo)
      ORDER BY ranked.value DESC, p.published_at DESC, p.id LIMIT $3`,
    [input.metric, currency, limit, process.env.NODE_ENV !== "production"],
  );
  return rows.map((row) => ({
    ...card(row),
    leaderboardValue: Number(row.leaderboard_value),
    leaderboardSource: row.leaderboard_source,
  }));
}

export function preferredMetrics(metrics: ProductMetric[], limit = 3): ProductMetric[] {
  const order: MetricType[] = ["revenue", "visitors", "outbound_clicks", "bids", "purchases", "refunds", "highest_bid", "current_bid", "partner_product_clicks"];
  const selected: ProductMetric[] = [];
  for (const type of order) {
    const metric = metrics.find((item) => item.type === type);
    if (metric) selected.push(metric);
    if (selected.length === limit) break;
  }
  return selected;
}

export type ProductDetail = ProductCardData & {
  description: string | null;
  founderName: string | null;
  founderSocialHandle: string | null;
  biddingMechanism: string | null;
  minimumBidMinor: number | null;
  currentBidMinor: number | null;
  bidCurrency: string | null;
  publicAnalyticsUrl: string | null;
  dataDisclosure: string | null;
  boardPosition: number | null;
  media: Array<{ id: string; kind: string; url: string; altText: string | null; position: number }>;
  updates: Array<{ id: string; type: string; title: string; body: string; linkUrl: string | null; publishedAt: Date; imageUrl: string | null }>;
};

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const cards = await query<ProductCardRow & {
    description: string | null; founder_name: string | null; founder_social_handle: string | null;
    bidding_mechanism: string | null; minimum_bid_minor: string | null; current_bid_minor: string | null;
    bid_currency: string | null; public_analytics_url: string | null; data_disclosure: string | null;
    board_position: number | null;
  }>(
    `SELECT ${CARD_COLUMNS}, p.description, p.founder_name, p.founder_social_handle,
            p.bidding_mechanism, p.minimum_bid_minor::text, p.current_bid_minor::text,
            p.bid_currency, p.public_analytics_url, p.data_disclosure,
            (SELECT position FROM (
              SELECT ranked.id, row_number() OVER (
                ORDER BY ranked.vote_count DESC, ranked.total_clicks DESC, ranked.published_at DESC, ranked.id
              )::int AS position
              FROM (
                SELECT candidate.id, candidate.published_at,
                  (SELECT count(*) FROM product_votes v WHERE v.product_id = candidate.id AND v.active
                    AND (candidate.is_demo OR NOT v.is_demo)) AS vote_count,
                  (SELECT count(*) FROM product_outbound_click_events e WHERE e.product_id = candidate.id
                    AND e.outcome = 'counted') AS total_clicks
                FROM products candidate WHERE candidate.status = 'published'
                  AND ($2::boolean OR NOT candidate.is_demo)
              ) ranked
            ) positions WHERE positions.id = p.id) AS board_position
       FROM products p WHERE p.slug = $1 AND p.status = 'published'
         AND ($2::boolean OR NOT p.is_demo) LIMIT 1`,
    [slug, process.env.NODE_ENV !== "production"],
  );
  const row = cards[0];
  if (!row) return null;
  const [media, updates] = await Promise.all([
    query<{ id: string; kind: string; public_url: string; alt_text: string | null; position: number }>(
      `SELECT id::text, kind, public_url, alt_text, position FROM product_media
        WHERE product_id = $1 ORDER BY CASE kind WHEN 'logo' THEN 0 ELSE 1 END, position`,
      [row.id],
    ),
    query<{ id: string; type: string; title: string; body: string; link_url: string | null; published_at: Date; image_url: string | null }>(
      `SELECT u.id::text, u.type, u.title, u.body, u.link_url, u.published_at, m.public_url AS image_url
         FROM product_updates u LEFT JOIN product_media m ON m.id = u.image_media_id
        WHERE u.product_id = $1 ORDER BY u.published_at DESC, u.id DESC`,
      [row.id],
    ),
  ]);
  return {
    ...card(row),
    description: row.description,
    founderName: row.founder_name,
    founderSocialHandle: row.founder_social_handle,
    biddingMechanism: row.bidding_mechanism,
    minimumBidMinor: row.minimum_bid_minor === null ? null : Number(row.minimum_bid_minor),
    currentBidMinor: row.current_bid_minor === null ? null : Number(row.current_bid_minor),
    bidCurrency: row.bid_currency,
    publicAnalyticsUrl: row.public_analytics_url,
    dataDisclosure: row.data_disclosure,
    boardPosition: row.board_position,
    media: media.map((item) => ({ id: item.id, kind: item.kind, url: item.public_url, altText: item.alt_text, position: item.position })),
    updates: updates.map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, linkUrl: item.link_url, publishedAt: new Date(item.published_at), imageUrl: item.image_url })),
  };
}

export type ManagedProduct = ProductDetail & {
  status: ProductStatus;
  contactEmail: string;
  approvedAt: Date | null;
  marketingOptedIn: boolean;
  marketingSuppressed: boolean;
};

export async function getManagedProduct(slug: string): Promise<(ManagedProduct & { ownerTokenHash: string; ownerTokenVersion: number }) | null> {
  const rows = await query<{
    id: string; status: ProductStatus; contact_email: string; approved_at: Date | null; token_hash: string; token_version: number; marketing_opted_in: boolean; marketing_suppressed: boolean;
  }>(
    `SELECT p.id::text,p.status,p.contact_email,p.approved_at,o.token_hash,o.token_version,
            (pref.marketing_unsubscribed_at IS NULL AND NOT EXISTS (SELECT 1 FROM founder_email_suppressions s WHERE s.normalized_email=pref.normalized_email)) AS marketing_opted_in,
            (pref.marketing_unsubscribed_at IS NOT NULL OR EXISTS (SELECT 1 FROM founder_email_suppressions s WHERE s.normalized_email=pref.normalized_email)) AS marketing_suppressed
       FROM products p JOIN product_owner_credentials o ON o.product_id = p.id
       JOIN founder_email_preferences pref ON pref.id=p.email_preference_id
      WHERE p.slug = $1 LIMIT 1`,
    [slug],
  );
  const auth = rows[0];
  if (!auth) return null;
  const publicDetail = await getProductDetailIncludingUnpublished(slug);
  return publicDetail ? { ...publicDetail, status: auth.status, contactEmail: auth.contact_email, approvedAt: auth.approved_at ? new Date(auth.approved_at) : null, marketingOptedIn:auth.marketing_opted_in,marketingSuppressed:auth.marketing_suppressed,ownerTokenHash: auth.token_hash, ownerTokenVersion: auth.token_version } : null;
}

async function getProductDetailIncludingUnpublished(slug: string): Promise<ProductDetail | null> {
  const rows = await query<{
    id: string; slug: string; website_url: string; name: string; tagline: string; launch_at: Date;
    published_at: Date | null; is_demo: boolean; description: string | null; founder_name: string | null;
    founder_social_handle: string | null; bidding_mechanism: string | null; minimum_bid_minor: string | null;
    current_bid_minor: string | null; bid_currency: string | null; public_analytics_url: string | null;
    data_disclosure: string | null; product_verified_at: Date | null;
  }>(
    `SELECT id::text, slug, website_url, name, tagline, launch_at, published_at, is_demo,
            description, founder_name, founder_social_handle, bidding_mechanism,
            minimum_bid_minor::text, current_bid_minor::text, bid_currency,
            public_analytics_url, data_disclosure,
            (SELECT i.product_verified_at FROM product_integrations i WHERE i.product_id=products.id) AS product_verified_at
       FROM products WHERE slug = $1 LIMIT 1`, [slug],
  );
  const row = rows[0];
  if (!row) return null;
  const [categories, media, updates, metrics, votes] = await Promise.all([
    query<{ slug: string; name: string }>(`SELECT c.slug, c.name FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = $1 ORDER BY pc.position`, [row.id]),
    query<{ id: string; kind: string; public_url: string; alt_text: string | null; position: number }>(`SELECT id::text, kind, public_url, alt_text, position FROM product_media WHERE product_id = $1 ORDER BY kind, position`, [row.id]),
    query<{ id: string; type: string; title: string; body: string; link_url: string | null; published_at: Date; image_url: string | null }>(`SELECT u.id::text, u.type, u.title, u.body, u.link_url, u.published_at, m.public_url AS image_url FROM product_updates u LEFT JOIN product_media m ON m.id = u.image_media_id WHERE u.product_id = $1 ORDER BY u.published_at DESC`, [row.id]),
    query<{ metric_type: MetricType; source: MetricSource; currency: string; value: string; source_url: string | null; updated_at: Date; last_event_at: Date | null; measurement_period: "all_time"|"today"|"last_30_days" }>(`SELECT metric_type,source,currency,(CASE WHEN metric_type='highest_bid' THEN max(value) WHEN metric_type='current_bid' THEN (array_agg(value ORDER BY updated_at DESC))[1] ELSE sum(value) END)::text AS value,max(source_url) AS source_url,max(updated_at) AS updated_at,max(last_event_at) AS last_event_at,(array_agg(measurement_period ORDER BY updated_at DESC))[1] AS measurement_period FROM (SELECT metric_type,CASE WHEN source='verified_by_bidindex' THEN 'measured_by_bidindex' WHEN source='verified_live' AND metric_type='visitors' THEN 'measured_by_bidindex' WHEN source='verified_live' THEN 'partner_connected' ELSE source END AS source,currency,value,source_url,updated_at,last_event_at,measurement_period FROM product_metric_aggregates WHERE product_id=$1 AND source_status='active') normalized GROUP BY metric_type,source,currency`, [row.id]),
    query<{ count: number }>(`SELECT count(*)::int AS count FROM product_votes WHERE product_id = $1 AND active`, [row.id]),
  ]);
  return {
    id: row.id, slug: row.slug, websiteUrl: row.website_url, name: row.name, tagline: row.tagline,
    launchAt: new Date(row.launch_at), publishedAt: new Date(row.published_at ?? row.launch_at), isDemo: row.is_demo,
    logoUrl: media.find((item) => item.kind === "logo")?.public_url ?? null, categories,
    voteCount: votes[0]?.count ?? 0, weeklyVotes: 0, weeklyClicks: 0, totalClicks: 0, updateCount: updates.length,
    metrics: metrics.map((item) => ({ type: item.metric_type, source: item.source, currency: item.currency, value: Number(item.value), sourceUrl: item.source_url, updatedAt: new Date(item.updated_at), lastEventAt: item.last_event_at ? new Date(item.last_event_at) : null, measurementPeriod: item.measurement_period })),
    isVerified: row.product_verified_at !== null,
    description: row.description, founderName: row.founder_name, founderSocialHandle: row.founder_social_handle,
    biddingMechanism: row.bidding_mechanism, minimumBidMinor: row.minimum_bid_minor === null ? null : Number(row.minimum_bid_minor),
    currentBidMinor: row.current_bid_minor === null ? null : Number(row.current_bid_minor), bidCurrency: row.bid_currency,
    publicAnalyticsUrl: row.public_analytics_url, dataDisclosure: row.data_disclosure, boardPosition: null,
    media: media.map((item) => ({ id: item.id, kind: item.kind, url: item.public_url, altText: item.alt_text, position: item.position })),
    updates: updates.map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, linkUrl: item.link_url, publishedAt: new Date(item.published_at), imageUrl: item.image_url })),
  };
}
