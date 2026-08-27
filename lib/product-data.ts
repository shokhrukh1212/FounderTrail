import "server-only";
import { query } from "./db";

export const DISCOVERY_VIEWS = ["today", "trending", "verified", "newest"] as const;
export type DiscoveryView = (typeof DISCOVERY_VIEWS)[number];
export type ProductStatus = "draft" | "pending" | "published" | "rejected" | "archived";
export type MetricSource = "verified_live" | "verified_by_bidindex" | "publicly_sourced" | "founder_reported";
export type MetricType = "visitors" | "revenue" | "outbound_clicks" | "bids" | "purchases" | "current_bid" | "highest_bid";

export type ProductMetric = {
  type: MetricType;
  source: MetricSource;
  currency: string;
  value: number;
  sourceUrl: string | null;
  updatedAt: Date;
  lastEventAt: Date | null;
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
  updateCount: number;
  metrics: ProductMetric[];
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
  update_count: number;
  metrics: Array<{
    type: MetricType;
    source: MetricSource;
    currency: string;
    value: string | number;
    sourceUrl: string | null;
    updatedAt: string;
    lastEventAt: string | null;
  }> | null;
};

const CARD_COLUMNS = `
  p.id::text, p.slug, p.website_url, p.name, p.tagline, p.launch_at,
  p.published_at, p.is_demo,
  (SELECT pm.public_url FROM product_media pm
    WHERE pm.product_id = p.id AND pm.kind = 'logo' LIMIT 1) AS logo_url,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('slug', c.slug, 'name', c.name) ORDER BY pc.position)
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
  (SELECT count(*)::int FROM product_updates pu WHERE pu.product_id = p.id) AS update_count,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'type', a.metric_type, 'source', a.source, 'currency', a.currency,
      'value', a.value::text, 'sourceUrl', a.source_url,
      'updatedAt', a.updated_at, 'lastEventAt', a.last_event_at)
    ORDER BY CASE a.source WHEN 'verified_by_bidindex' THEN 1 WHEN 'verified_live' THEN 2
      WHEN 'publicly_sourced' THEN 3 ELSE 4 END, a.metric_type, a.currency)
    FROM product_metric_aggregates a WHERE a.product_id = p.id), '[]'::jsonb) AS metrics
`;

const ORDER: Record<DiscoveryView, string> = {
  today: `weekly_votes DESC, weekly_clicks DESC, p.published_at DESC, p.id`,
  trending: `weekly_votes DESC, weekly_clicks DESC, p.published_at DESC, p.id`,
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
    updateCount: Number(row.update_count),
    metrics: (row.metrics ?? []).map((metric) => ({
      ...metric,
      value: Number(metric.value),
      updatedAt: new Date(metric.updatedAt),
      lastEventAt: metric.lastEventAt ? new Date(metric.lastEventAt) : null,
    })),
  };
}

export async function getDiscoveryProducts(input: {
  view?: string;
  query?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<ProductCardData[]> {
  const view: DiscoveryView = DISCOVERY_VIEWS.includes(input.view as DiscoveryView)
    ? input.view as DiscoveryView
    : "trending";
  const search = (input.query ?? "").trim().slice(0, 80);
  const limit = Math.max(1, Math.min(input.limit ?? 30, 50));
  const offset = Math.max(0, Math.min(input.offset ?? 0, 10_000));
  const filters = [
    `p.status = 'published'`,
    process.env.NODE_ENV === "production" ? `p.is_demo = false` : `true`,
  ];
  const params: unknown[] = [];
  if (view === "today") {
    filters.push(`p.launch_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
      AND p.launch_at < (date_trunc('day', now() AT TIME ZONE 'UTC') + interval '1 day') AT TIME ZONE 'UTC'`);
  }
  if (view === "verified") {
    filters.push(`EXISTS (SELECT 1 FROM product_metric_aggregates verified
      WHERE verified.product_id = p.id
        AND verified.source IN ('verified_live','verified_by_bidindex'))`);
  }
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    const index = params.length;
    filters.push(`(p.name ILIKE $${index} ESCAPE '\\' OR p.tagline ILIKE $${index} ESCAPE '\\'
      OR EXISTS (SELECT 1 FROM product_categories search_pc JOIN categories search_c ON search_c.id = search_pc.category_id
        WHERE search_pc.product_id = p.id AND search_c.name ILIKE $${index} ESCAPE '\\'))`);
  }
  params.push(limit, offset);
  const rows = await query<ProductCardRow>(
    `SELECT ${CARD_COLUMNS}
       FROM products p
      WHERE ${filters.join(" AND ")}
      ORDER BY ${ORDER[view]}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return rows.map(card);
}

export type EcosystemSnapshot = {
  products: number;
  verifiedPartners: number;
  revenueByCurrency: Array<{ currency: string; value: number }>;
  outboundClicks: number;
};

export async function getEcosystemSnapshot(): Promise<EcosystemSnapshot> {
  const includeDemo = process.env.NODE_ENV !== "production";
  const [counts, revenue] = await Promise.all([
    query<{ products: string; verified: string; clicks: string }>(
      `SELECT count(*)::text AS products,
              count(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM product_metric_aggregates a
                 WHERE a.product_id = p.id AND a.source IN ('verified_live','verified_by_bidindex')
              ))::text AS verified,
              COALESCE((SELECT sum(a.value) FROM product_metric_aggregates a
                JOIN products cp ON cp.id = a.product_id
               WHERE a.metric_type = 'outbound_clicks' AND a.source = 'verified_by_bidindex'
                 AND cp.status = 'published' AND ($1::boolean OR NOT cp.is_demo)), 0)::text AS clicks
         FROM products p WHERE p.status = 'published' AND ($1::boolean OR NOT p.is_demo)`,
      [includeDemo],
    ),
    query<{ currency: string; value: string }>(
      `SELECT a.currency, sum(a.value)::text AS value
         FROM product_metric_aggregates a JOIN products p ON p.id = a.product_id
        WHERE a.metric_type = 'revenue'
          AND a.source IN ('verified_live','publicly_sourced')
          AND p.status = 'published' AND ($1::boolean OR NOT p.is_demo)
        GROUP BY a.currency ORDER BY a.currency`,
      [includeDemo],
    ),
  ]);
  return {
    products: Number(counts[0]?.products ?? 0),
    verifiedPartners: Number(counts[0]?.verified ?? 0),
    outboundClicks: Number(counts[0]?.clicks ?? 0),
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
      WHERE v.voter_hash = $1 AND v.active AND p.status = 'published'`,
    [voterHash],
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
         SELECT a.value, a.source
           FROM product_metric_aggregates a
          WHERE a.product_id = p.id AND a.metric_type = $1
            AND a.source IN ('verified_live','verified_by_bidindex','publicly_sourced')
            AND ($2 = '' OR a.currency = $2)
          ORDER BY CASE a.source WHEN 'verified_by_bidindex' THEN 1 WHEN 'verified_live' THEN 2 ELSE 3 END
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
  const order: MetricType[] = ["revenue", "visitors", "outbound_clicks", "bids", "purchases", "highest_bid", "current_bid"];
  const selected: ProductMetric[] = [];
  for (const type of order) {
    const metric = metrics.find((item) => item.type === type);
    if (metric) selected.push(metric);
    if (selected.length === limit) break;
  }
  return selected;
}

export type ProductDetail = ProductCardData & {
  description: string;
  founderName: string;
  founderSocialHandle: string | null;
  biddingMechanism: string;
  minimumBidMinor: number | null;
  currentBidMinor: number | null;
  bidCurrency: string | null;
  publicAnalyticsUrl: string | null;
  dataDisclosure: string | null;
  weeklyPosition: number | null;
  media: Array<{ id: string; kind: string; url: string; altText: string | null; position: number }>;
  updates: Array<{ id: string; type: string; title: string; body: string; linkUrl: string | null; publishedAt: Date; imageUrl: string | null }>;
};

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const cards = await query<ProductCardRow & {
    description: string; founder_name: string; founder_social_handle: string | null;
    bidding_mechanism: string; minimum_bid_minor: string | null; current_bid_minor: string | null;
    bid_currency: string | null; public_analytics_url: string | null; data_disclosure: string | null;
    weekly_position: number | null;
  }>(
    `SELECT ${CARD_COLUMNS}, p.description, p.founder_name, p.founder_social_handle,
            p.bidding_mechanism, p.minimum_bid_minor::text, p.current_bid_minor::text,
            p.bid_currency, p.public_analytics_url, p.data_disclosure,
            (SELECT position FROM (
              SELECT ranked.id, row_number() OVER (
                ORDER BY ranked.weekly_votes DESC, ranked.weekly_clicks DESC, ranked.published_at DESC, ranked.id
              )::int AS position
              FROM (
                SELECT candidate.id, candidate.published_at,
                  (SELECT count(*) FROM product_votes v WHERE v.product_id = candidate.id AND v.active
                    AND v.first_upvoted_at >= now() - interval '7 days') AS weekly_votes,
                  (SELECT count(*) FROM product_outbound_click_events e WHERE e.product_id = candidate.id
                    AND e.outcome = 'counted' AND e.created_at >= now() - interval '7 days') AS weekly_clicks
                FROM products candidate WHERE candidate.status = 'published'
              ) ranked
            ) positions WHERE positions.id = p.id) AS weekly_position
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
    weeklyPosition: row.weekly_position,
    media: media.map((item) => ({ id: item.id, kind: item.kind, url: item.public_url, altText: item.alt_text, position: item.position })),
    updates: updates.map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, linkUrl: item.link_url, publishedAt: new Date(item.published_at), imageUrl: item.image_url })),
  };
}

export type ManagedProduct = ProductDetail & {
  status: ProductStatus;
  contactEmail: string;
};

export async function getManagedProduct(slug: string): Promise<(ManagedProduct & { ownerTokenHash: string }) | null> {
  const rows = await query<{
    id: string; status: ProductStatus; contact_email: string; token_hash: string;
  }>(
    `SELECT p.id::text, p.status, p.contact_email, o.token_hash
       FROM products p JOIN product_owner_credentials o ON o.product_id = p.id
      WHERE p.slug = $1 LIMIT 1`,
    [slug],
  );
  const auth = rows[0];
  if (!auth) return null;
  const publicDetail = await getProductDetailIncludingUnpublished(slug);
  return publicDetail ? { ...publicDetail, status: auth.status, contactEmail: auth.contact_email, ownerTokenHash: auth.token_hash } : null;
}

async function getProductDetailIncludingUnpublished(slug: string): Promise<ProductDetail | null> {
  const rows = await query<{
    id: string; slug: string; website_url: string; name: string; tagline: string; launch_at: Date;
    published_at: Date | null; is_demo: boolean; description: string; founder_name: string;
    founder_social_handle: string | null; bidding_mechanism: string; minimum_bid_minor: string | null;
    current_bid_minor: string | null; bid_currency: string | null; public_analytics_url: string | null;
    data_disclosure: string | null;
  }>(
    `SELECT id::text, slug, website_url, name, tagline, launch_at, published_at, is_demo,
            description, founder_name, founder_social_handle, bidding_mechanism,
            minimum_bid_minor::text, current_bid_minor::text, bid_currency,
            public_analytics_url, data_disclosure
       FROM products WHERE slug = $1 LIMIT 1`, [slug],
  );
  const row = rows[0];
  if (!row) return null;
  const [categories, media, updates, metrics, votes] = await Promise.all([
    query<{ slug: string; name: string }>(`SELECT c.slug, c.name FROM product_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.product_id = $1 ORDER BY pc.position`, [row.id]),
    query<{ id: string; kind: string; public_url: string; alt_text: string | null; position: number }>(`SELECT id::text, kind, public_url, alt_text, position FROM product_media WHERE product_id = $1 ORDER BY kind, position`, [row.id]),
    query<{ id: string; type: string; title: string; body: string; link_url: string | null; published_at: Date; image_url: string | null }>(`SELECT u.id::text, u.type, u.title, u.body, u.link_url, u.published_at, m.public_url AS image_url FROM product_updates u LEFT JOIN product_media m ON m.id = u.image_media_id WHERE u.product_id = $1 ORDER BY u.published_at DESC`, [row.id]),
    query<{ metric_type: MetricType; source: MetricSource; currency: string; value: string; source_url: string | null; updated_at: Date; last_event_at: Date | null }>(`SELECT metric_type, source, currency, value::text, source_url, updated_at, last_event_at FROM product_metric_aggregates WHERE product_id = $1`, [row.id]),
    query<{ count: number }>(`SELECT count(*)::int AS count FROM product_votes WHERE product_id = $1 AND active`, [row.id]),
  ]);
  return {
    id: row.id, slug: row.slug, websiteUrl: row.website_url, name: row.name, tagline: row.tagline,
    launchAt: new Date(row.launch_at), publishedAt: new Date(row.published_at ?? row.launch_at), isDemo: row.is_demo,
    logoUrl: media.find((item) => item.kind === "logo")?.public_url ?? null, categories,
    voteCount: votes[0]?.count ?? 0, weeklyVotes: 0, weeklyClicks: 0, updateCount: updates.length,
    metrics: metrics.map((item) => ({ type: item.metric_type, source: item.source, currency: item.currency, value: Number(item.value), sourceUrl: item.source_url, updatedAt: new Date(item.updated_at), lastEventAt: item.last_event_at ? new Date(item.last_event_at) : null })),
    description: row.description, founderName: row.founder_name, founderSocialHandle: row.founder_social_handle,
    biddingMechanism: row.bidding_mechanism, minimumBidMinor: row.minimum_bid_minor === null ? null : Number(row.minimum_bid_minor),
    currentBidMinor: row.current_bid_minor === null ? null : Number(row.current_bid_minor), bidCurrency: row.bid_currency,
    publicAnalyticsUrl: row.public_analytics_url, dataDisclosure: row.data_disclosure, weeklyPosition: null,
    media: media.map((item) => ({ id: item.id, kind: item.kind, url: item.public_url, altText: item.alt_text, position: item.position })),
    updates: updates.map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, linkUrl: item.link_url, publishedAt: new Date(item.published_at), imageUrl: item.image_url })),
  };
}
