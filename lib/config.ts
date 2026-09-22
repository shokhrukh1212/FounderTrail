import { brand, brandCopy } from "./brand";

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  siteUrl: (process.env.SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, ""),
  siteName: process.env.SITE_NAME ?? brand.displayName,
  siteDescription:
    process.env.SITE_DESCRIPTION ??
    brandCopy.metaDescription,
  accentColor: process.env.SITE_ACCENT_COLOR ?? "#FF6154",
  eventHashSalt: process.env.EVENT_HASH_SALT ?? process.env.IP_HASH_SALT ?? "dev-event-salt-change-me",
  adminAccessSecret: process.env.ADMIN_ACCESS_SECRET ?? "",
  adminAuditActor: process.env.ADMIN_AUDIT_ACTOR ?? "Shokhrukh Karimov",
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
  bidIndexXHandle: process.env.NEXT_PUBLIC_BIDINDEX_X_HANDLE ?? "",
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
    from: process.env.EMAIL_FROM ?? "",
    replyTo: process.env.EMAIL_REPLY_TO ?? "",
  },
  auth: {
    secret: process.env.AUTH_SECRET ?? "",
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  metricEncryptionKey: process.env.METRIC_ENCRYPTION_KEY ?? "",
  // Public sponsorship sales and delivery are retired for the Pro Launch release.
  // The legacy switch exists only for explicit reconciliation/refund operations.
  sponsorshipsEnabled: false,
  legacySponsorshipsEnabled: process.env.LEGACY_SPONSORSHIPS_ENABLED === "true",
  proLaunchEnabled: process.env.PRO_LAUNCH_CHECKOUT_ENABLED === "true",
  proReportEmailEnabled: process.env.PRO_REPORT_EMAIL_ENABLED === "true",
  /**
   * Founder-connected Stripe revenue/MRR. Off until the connector is finished: it still
   * needs Stripe OAuth/Connect rather than a pasted key, so nothing about revenue is
   * shown publicly. See the deferred-work section of the launch notes.
   */
  founderMetricsEnabled: false,
  /** Manually maintained Ahrefs proof point. Both values must be set or nothing renders. */
  ahrefs: {
    domainRating: process.env.AHREFS_DR ?? "",
    checkedAt: process.env.AHREFS_DR_CHECKED_AT ?? "",
  },
  sponsorship: {
    currency: "USD" as const,
    /** Three concurrent placements site-wide. The database enforces this, not this number. */
    slots: 3,
    holdMinutes: 15,
    minimumLeadMinutes: 20,
    /** One-time purchases, never subscriptions. Prices are in minor units. */
    tiers: [
      { days: 7, priceMinor: 2000 },
      { days: 30, priceMinor: 6000 },
    ] as const,
  },
  dodoPayments: {
    apiKey: process.env.DODO_PAYMENTS_API_KEY ?? "",
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "",
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" as const : "test_mode" as const,
    businessId: process.env.DODO_PAYMENTS_BUSINESS_ID ?? "",
    // One Dodo product per duration. The single-product variable is kept as the 7-day
    // fallback so an existing deployment does not break on upgrade.
    sponsorProductId7d: process.env.DODO_SPONSOR_PRODUCT_ID_7D || process.env.DODO_SPONSOR_PRODUCT_ID || "",
    sponsorProductId30d: process.env.DODO_SPONSOR_PRODUCT_ID_30D ?? "",
    proIntroProductId: process.env.DODO_PRO_INTRO_PRODUCT_ID ?? "",
    proStandardProductId: process.env.DODO_PRO_STANDARD_PRODUCT_ID ?? "",
  },
  upload: {
    driver: process.env.UPLOAD_STORAGE_DRIVER ?? "local",
    localDirectory: process.env.UPLOAD_LOCAL_DIR ?? ".data/uploads",
    s3: {
      region: process.env.STORAGE_S3_REGION ?? "",
      bucket: process.env.STORAGE_S3_BUCKET ?? "",
      accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY ?? "",
      publicBaseUrl: process.env.STORAGE_S3_PUBLIC_BASE_URL ?? "",
      endpoint: process.env.STORAGE_S3_ENDPOINT ?? "",
      forcePathStyle: process.env.STORAGE_S3_FORCE_PATH_STYLE === "true",
    },
  },
  allowLocalPartnerOrigins:
    process.env.NODE_ENV !== "production" && process.env.ALLOW_LOCAL_PARTNER_ORIGINS === "true",

  /** How long an unpaid bid checkout remains reusable. It never holds rank. */
  reservationMinutes: int("RESERVATION_MINUTES", 10),

  cronSecret: process.env.CRON_SECRET ?? "",
  ipHashSalt: process.env.IP_HASH_SALT ?? "dev-salt-change-me",

  lemonSqueezy: {
    apiKey: process.env.LEMONSQUEEZY_API_KEY ?? "",
    storeId: process.env.LEMONSQUEEZY_STORE_ID ?? "",
    variantId: process.env.LEMONSQUEEZY_VARIANT_ID ?? "",
    webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "",
  },

  vemetric: {
    token: process.env.VEMETRIC_TOKEN ?? "",
    // Private read key for the analytics query API. Server-only; never NEXT_PUBLIC_.
    apiKey: process.env.VEMETRIC_API_KEY ?? "",
    // Linked from the admin subnav's all-time visitor stat, not from the public header.
    publicDashboardUrl:
      process.env.VEMETRIC_PUBLIC_DASHBOARD_URL ?? "https://app.vemetric.com/public/bidindex.dev",
  },

  metaPixel: {
    // Not a secret -- it ships inside the browser tag.
    id: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",
  },

  xPixel: {
    // Not a secret -- it ships inside the browser tag.
    id: process.env.NEXT_PUBLIC_X_PIXEL_ID ?? "",
    // The Conversions API bearer. Server-only; never prefix with NEXT_PUBLIC_.
    accessToken: process.env.X_PIXEL_ACCESS_TOKEN ?? "",
    // Optional: the id of a specific conversion event created in X Ads Events Manager
    // (e.g. a "Purchase" action). Omitted from calls when unset.
    purchaseEventId: process.env.X_PIXEL_PURCHASE_EVENT_ID ?? "",
  },
} as const;

export function isAuthConfigured(): boolean {
  return config.auth.secret.length >= 32 && Boolean(config.auth.googleClientId && config.auth.googleClientSecret);
}

export type SponsorTier = { days: number; priceMinor: number; productId: string };

/** The purchasable durations, each with the Dodo product that must appear in the cart. */
export function sponsorTiers(): SponsorTier[] {
  return config.sponsorship.tiers.map((tier) => ({
    days: tier.days,
    priceMinor: tier.priceMinor,
    productId: tier.days === 30 ? config.dodoPayments.sponsorProductId30d : config.dodoPayments.sponsorProductId7d,
  }));
}

export function sponsorTier(days: number): SponsorTier | null {
  return sponsorTiers().find((tier) => tier.days === days) ?? null;
}

/**
 * What the longer placement saves against buying the shorter one repeatedly.
 *
 * The comparison is whole purchases -- four 7-day placements, not a pro-rata 30/7 -- so
 * the quoted saving is one a buyer could actually make. Four weeks is 28 days, so the
 * 30-day placement is slightly better than the number claims, never worse. Computed
 * rather than written into copy so the page cannot quote a stale figure.
 */
export function sponsorSavings(): { savedMinor: number; percent: number; periods: number } | null {
  const [short, long] = config.sponsorship.tiers;
  if (!short || !long) return null;
  const periods = Math.floor(long.days / short.days);
  if (periods < 2) return null;
  const equivalent = short.priceMinor * periods;
  const savedMinor = equivalent - long.priceMinor;
  if (savedMinor <= 0) return null;
  return { savedMinor, percent: Math.round((savedMinor / equivalent) * 100), periods };
}

export function isDodoConfigured(): boolean {
  const dodo = config.dodoPayments;
  return config.legacySponsorshipsEnabled
    && Boolean(dodo.apiKey && dodo.webhookKey && dodo.businessId)
    && sponsorTiers().every((tier) => Boolean(tier.productId));
}

export function isDodoProviderConfigured(): boolean {
  const dodo = config.dodoPayments;
  return Boolean(dodo.apiKey && dodo.webhookKey && dodo.businessId);
}

export function isProLaunchConfigured(): boolean {
  const dodo = config.dodoPayments;
  return config.proLaunchEnabled
    && isDodoProviderConfigured()
    && Boolean(dodo.proIntroProductId && dodo.proStandardProductId);
}

export function isLemonSqueezyConfigured(): boolean {
  const { apiKey, storeId, variantId } = config.lemonSqueezy;
  return !!(apiKey && storeId && variantId);
}

/**
 * Ahrefs Domain Rating, or null.
 *
 * Deliberately strict: a missing, malformed or undated value renders nothing rather than
 * a stale or invented number. DR is Ahrefs' own backlink metric, not a Google ranking or
 * an authority score, and the page must say so wherever this appears.
 */
export function ahrefsProof(): { rating: number; checkedAt: string } | null {
  const rating = Number.parseInt(config.ahrefs.domainRating, 10);
  const checkedAt = config.ahrefs.checkedAt.trim();
  if (!Number.isInteger(rating) || rating < 0 || rating > 100) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt) || Number.isNaN(Date.parse(checkedAt))) return null;
  return { rating, checkedAt };
}
