import "server-only";
import { config } from "./config";
import { query } from "./db";
import { FOUNDERTRAIL_CATEGORIES, FOUNDERTRAIL_CATEGORY_SLUGS } from "./categories";
import { decodeEntities, displayProductName, publicText } from "./display-text";

let warnedAboutMissingProSchema = false;

async function proEntitlementSelect(): Promise<string> {
  const rows = await query<{ available: boolean }>(
    `SELECT to_regclass('public.pro_entitlements') IS NOT NULL AS available`,
  );
  if (rows[0]?.available) {
    return `EXISTS(SELECT 1 FROM pro_entitlements pe WHERE pe.product_id=p.id AND pe.status='active')`;
  }
  if (!warnedAboutMissingProSchema) {
    warnedAboutMissingProSchema = true;
    console.warn("FounderTrail Pro migration 016 is not applied; rendering discovery without Pro badges.");
  }
  return "false";
}

export type FounderTrailView = "this_week" | "discover" | "updates";
export type DiscoverySort = "most_upvoted" | "newest";

export type StartupCard = {
  id: string;
  slug: string;
  websiteUrl: string;
  /** The brand name to print: the reviewed short name when one exists. */
  name: string;
  tagline: string;
  logoUrl: string | null;
  categories: Array<{ slug: string; name: string }>;
  followerCount: number;
  allTimeUpvotes: number;
  commentCount: number;
  upvoted: boolean;
  launchId: string | null;
  launchVotes: number;
  followed: boolean;
  isPro: boolean;
};

type StartupRow = {
  id: string; slug: string; website_url: string; name: string; short_name: string | null; tagline: string;
  logo_url: string | null; categories: Array<{ slug: string; name: string }> | null;
  follower_count: number; all_time_upvotes: number; comment_count: number; upvoted: boolean;
  launch_id: string | null; launch_votes: number; followed: boolean; is_pro: boolean;
};

function mapStartup(row: StartupRow): StartupCard {
  return {
    id: row.id, slug: row.slug, websiteUrl: row.website_url,
    name: displayProductName(row.name, row.short_name), tagline: publicText(row.tagline),
    logoUrl: row.logo_url,
    categories: row.categories ?? [],
    followerCount: Number(row.follower_count),
    allTimeUpvotes: Number(row.all_time_upvotes), commentCount: Number(row.comment_count), upvoted: row.upvoted,
    launchId: row.launch_id, launchVotes: Number(row.launch_votes), followed: row.followed, isPro: row.is_pro,
  };
}

export type DiscoveryResult = { products: StartupCard[]; total: number; page: number; pageCount: number; week: { startsAt: Date; endsAt: Date } | null };

export async function getFounderTrailDiscovery(input: {
  view: Exclude<FounderTrailView, "updates">; search?: string; category?: string;
  pricing?: string; sort?: DiscoverySort; page?: number; userId?: string | null;
}): Promise<DiscoveryResult> {
  const pageSize = 24;
  const baseParams: unknown[] = [process.env.NODE_ENV !== "production"];
  const filters = [`p.status='published'`, `($1::boolean OR NOT p.is_demo)`];
  let launchJoin = `LEFT JOIN product_launches pl ON false LEFT JOIN launch_weeks lw ON false`;
  if (input.view === "this_week") {
    launchJoin = `JOIN product_launches pl ON pl.product_id=p.id AND pl.state IN ('scheduled','active')
      JOIN launch_weeks lw ON lw.id=pl.launch_week_id AND lw.starts_at<=now() AND now()<lw.ends_at AND lw.state IN ('scheduled','active')`;
  }
  const search = (input.search ?? "").trim().slice(0, 80);
  if (search) {
    baseParams.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    const n = baseParams.length;
    filters.push(`(p.name ILIKE $${n} ESCAPE '\\' OR coalesce(p.short_name,'') ILIKE $${n} ESCAPE '\\' OR p.tagline ILIKE $${n} ESCAPE '\\' OR coalesce(p.description,'') ILIKE $${n} ESCAPE '\\' OR coalesce(p.use_case,'') ILIKE $${n} ESCAPE '\\')`);
  }
  // Any of a product's one-to-three categories matches, combined with the other filters.
  // EXISTS rather than a join, so a product is never counted or listed twice.
  if (input.category) {
    baseParams.push(input.category);
    filters.push(`EXISTS(SELECT 1 FROM product_categories fpc JOIN categories fc ON fc.id=fpc.category_id
      WHERE fpc.product_id=p.id AND fc.slug=$${baseParams.length})`);
  }
  if (input.pricing) {
    baseParams.push(input.pricing);
    filters.push(input.pricing === "unknown"
      ? `coalesce(p.pricing_model,'unknown')=$${baseParams.length}`
      : `p.pricing_model=$${baseParams.length}`);
  }
  const base = `FROM products p ${launchJoin} WHERE ${filters.join(" AND ")}`;
  const totalRows = await query<{ total: number }>(`SELECT count(*)::int AS total ${base}`, baseParams);
  const total = totalRows[0]?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(Math.trunc(input.page ?? 1), pageCount));
  const params=[...baseParams,input.userId??null];const userParameter=params.length;
  params.push(pageSize, (page - 1) * pageSize);
  const order = input.view === "this_week"
    ? `launch_votes DESC,pl.approved_at,p.id`
    : input.sort === "newest" ? `p.created_at DESC,p.id` : `all_time_upvotes DESC,p.created_at,p.id`;
  const isPro = await proEntitlementSelect();
  const rows = await query<StartupRow>(`SELECT p.id::text,p.slug,p.website_url,p.name,p.short_name,p.tagline,
      COALESCE((SELECT m.public_url FROM product_media m WHERE m.product_id=p.id AND m.kind='logo' LIMIT 1),
        (SELECT '/api/products/'||p.slug||'/logo' FROM product_submission_metadata sm WHERE sm.product_id=p.id AND sm.extracted_logo_url IS NOT NULL LIMIT 1)) AS logo_url,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('slug',cc.slug,'name',cc.name) ORDER BY pc.position)
        FROM product_categories pc JOIN categories cc ON cc.id=pc.category_id WHERE pc.product_id=p.id),'[]'::jsonb) AS categories,
      (SELECT count(*)::int FROM product_follows f WHERE f.product_id=p.id) AS follower_count,
      (SELECT count(*)::int FROM product_votes pv WHERE pv.product_id=p.id AND pv.active AND (p.is_demo OR NOT pv.is_demo)) AS all_time_upvotes,
      (SELECT count(*)::int FROM product_comments pcm WHERE pcm.product_id=p.id AND pcm.hidden_at IS NULL) AS comment_count,
      CASE WHEN $${userParameter}::text IS NULL THEN false ELSE EXISTS(SELECT 1 FROM product_votes pv WHERE pv.product_id=p.id AND pv.user_id=$${userParameter} AND pv.active) END AS upvoted,
      pl.id::text AS launch_id,
      CASE WHEN pl.id IS NULL THEN 0 ELSE (SELECT count(*)::int FROM launch_votes lv WHERE lv.launch_id=pl.id AND lv.active) END AS launch_votes,
      CASE WHEN $${userParameter}::text IS NULL THEN false ELSE EXISTS(SELECT 1 FROM product_follows f WHERE f.product_id=p.id AND f.user_id=$${userParameter}) END AS followed
      ,${isPro} AS is_pro
    ${base} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  const weekRows = input.view === "this_week" ? await query<{ starts_at: Date; ends_at: Date }>(
    `SELECT starts_at,ends_at FROM launch_weeks WHERE starts_at<=now() AND now()<ends_at AND state IN ('scheduled','active') LIMIT 1`,
  ) : [];
  return { products: rows.map(mapStartup), total, page, pageCount, week: weekRows[0] ? { startsAt: new Date(weekRows[0].starts_at), endsAt: new Date(weekRows[0].ends_at) } : null };
}

export type CategoryFacet = { slug: string; name: string; count: number };

/**
 * The taxonomy with how many published startups sit in each category. A product is counted
 * once per category it belongs to, never twice. The full list is always returned, so every
 * filter can be offered even while every product is still Other.
 */
export async function getCategoryFacets(): Promise<CategoryFacet[]> {
  const rows = await query<{ slug: string; name: string; count: number }>(
    `SELECT c.slug,c.name,
            (SELECT count(DISTINCT pc.product_id)::int
               FROM product_categories pc JOIN products p ON p.id=pc.product_id
              WHERE pc.category_id=c.id AND p.status='published' AND ($2::boolean OR NOT p.is_demo)) AS count
       FROM categories c WHERE c.slug=ANY($1::text[])`,
    [FOUNDERTRAIL_CATEGORY_SLUGS, process.env.NODE_ENV !== "production"],
  );
  const counts = new Map(rows.map((row) => [row.slug, Number(row.count)]));
  return FOUNDERTRAIL_CATEGORIES.map((category) => ({
    slug: category.slug,
    name: category.name,
    count: counts.get(category.slug) ?? 0,
  }));
}

export type UpdateFeedItem = { id: string; productSlug: string; productName: string; logoUrl: string | null; type: string; title: string; body: string; linkUrl: string | null; publishedAt: Date };

export async function getUpdateFeed(page = 1, userId: string | null = null, followedOnly = false): Promise<{ updates: UpdateFeedItem[]; total: number; page: number; pageCount: number }> {
  const size = 24;
  const where = `u.status='published' AND u.published_at IS NOT NULL AND p.status='published' AND ($1::boolean OR NOT p.is_demo)${followedOnly ? ` AND EXISTS(SELECT 1 FROM product_follows f WHERE f.product_id=p.id AND f.user_id=$2)` : ""}`;
  const baseParams: unknown[] = followedOnly ? [process.env.NODE_ENV !== "production", userId] : [process.env.NODE_ENV !== "production"];
  const count = await query<{ total: number }>(`SELECT count(*)::int AS total FROM product_updates u JOIN products p ON p.id=u.product_id WHERE ${where}`, baseParams);
  const total = count[0]?.total ?? 0; const pageCount = Math.max(1, Math.ceil(total / size)); const current = Math.max(1, Math.min(Math.trunc(page), pageCount));
  const rows = await query<{ id: string; product_slug: string; product_name: string; short_name: string | null; logo_url: string | null; type: string; title: string; body: string; link_url: string | null; published_at: Date }>(
    `SELECT u.id::text,p.slug AS product_slug,p.name AS product_name,p.short_name,(SELECT m.public_url FROM product_media m WHERE m.product_id=p.id AND m.kind='logo' LIMIT 1) AS logo_url,u.type,u.title,u.body,u.link_url,u.published_at
      FROM product_updates u JOIN products p ON p.id=u.product_id WHERE ${where} ORDER BY u.published_at DESC,u.id DESC LIMIT $${baseParams.length + 1} OFFSET $${baseParams.length + 2}`,
    [...baseParams, size, (current - 1) * size],
  );
  return { updates: rows.map((row) => ({ id: row.id, productSlug: row.product_slug, productName: displayProductName(row.product_name, row.short_name), logoUrl: row.logo_url, type: row.type, title: publicText(row.title), body: decodeEntities(row.body), linkUrl: row.link_url, publishedAt: new Date(row.published_at) })), total, page: current, pageCount };
}

export type ActiveSponsor = { id: string; productId: string; slug: string; name: string; tagline: string; logoUrl: string | null; category: string | null };

/**
 * The sponsors currently running. Completely separate from the organic queries in this
 * module: it never joins into, filters or reorders the product result set, so a paid
 * placement cannot move an organic rank.
 *
 * Rotation is by fewest impressions served today, so with more than one active sponsor
 * the exposure evens out instead of always favouring the earliest booking. It is computed
 * on the server, so there is no hydration mismatch.
 */
export async function getActiveSponsors(options: { limit?: number; excludeProductId?: string } = {}): Promise<ActiveSponsor[]> {
  const limit = Math.max(0, Math.min(options.limit ?? 3, 3));
  if (limit === 0) return [];
  const rows = await query<{ id: string; product_id: string; slug: string; name: string; tagline: string; logo_url: string | null; category: string | null }>(
    `SELECT b.id::text,b.product_id::text,p.slug,b.creative_name AS name,b.creative_tagline AS tagline,
      (SELECT m.public_url FROM product_media m WHERE m.product_id=p.id AND m.kind='logo' LIMIT 1) AS logo_url,
      (SELECT c.name FROM categories c WHERE c.id=p.primary_category_id) AS category
      FROM sponsor_bookings b JOIN products p ON p.id=b.product_id
      WHERE b.payment_status IN ('paid','complimentary')
        AND b.start_at<=now() AND now()<b.end_at
        AND b.booking_status IN ('scheduled','active')
        AND ($2::uuid IS NULL OR b.product_id<>$2::uuid)
      ORDER BY (
        SELECT count(*) FROM sponsor_events e
         WHERE e.booking_id=b.id AND e.event_type='impression' AND e.created_at>=date_trunc('day',now())
      ) ASC, b.start_at, b.id
      LIMIT $1`,
    [limit, options.excludeProductId ?? null],
  );
  return rows.map((row) => ({
    id: row.id, productId: row.product_id, slug: row.slug,
    name: row.name, tagline: row.tagline, logoUrl: row.logo_url, category: row.category,
  }));
}

export type SponsorDayAvailability = { date: string; used: number; capacity: number };

/**
 * Per-day capacity as used/total, for the Advertise page and the admin calendar. A day is
 * "used" by any booking that overlaps it and holds inventory, including unexpired holds
 * and pending refunds -- an open slot here is availability, never a sale.
 */
export async function getSponsorAvailability(from: Date, days: number): Promise<SponsorDayAvailability[]> {
  const rows = await query<{ day: Date; used: number }>(
    `WITH span AS (
       SELECT generate_series(date_trunc('day',$1::timestamptz), date_trunc('day',$1::timestamptz) + make_interval(days => $2::int - 1), interval '1 day') AS day
     )
     SELECT span.day,
            (SELECT count(DISTINCT b.slot_index)::int FROM sponsor_bookings b
              WHERE b.booking_status IN ('held','scheduled','active','refund_pending')
                AND tstzrange(b.start_at,b.end_at,'[)') && tstzrange(span.day, span.day + interval '1 day','[)')
            ) AS used
       FROM span ORDER BY span.day`,
    [from, days],
  );
  return rows.map((row) => ({ date: row.day.toISOString(), used: row.used, capacity: config.sponsorship.slots }));
}
