import { brandCopy } from "./brand";

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  siteUrl: (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  siteName: process.env.SITE_NAME ?? "BidIndex",
  siteDescription:
    process.env.SITE_DESCRIPTION ??
    brandCopy.metaDescription,
  accentColor: process.env.SITE_ACCENT_COLOR ?? "#FF6154",
  featurePromotions: process.env.FEATURE_PROMOTIONS === "true",
  eventHashSalt: process.env.EVENT_HASH_SALT ?? process.env.IP_HASH_SALT ?? "dev-event-salt-change-me",
  adminAccessSecret: process.env.ADMIN_ACCESS_SECRET ?? "",
  adminAuditActor: process.env.ADMIN_AUDIT_ACTOR ?? "Shokhrukh Karimov",
  adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "",
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET ?? "",
    from: process.env.EMAIL_FROM ?? "",
    replyTo: process.env.EMAIL_REPLY_TO ?? "",
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

export function isLemonSqueezyConfigured(): boolean {
  const { apiKey, storeId, variantId } = config.lemonSqueezy;
  return !!(apiKey && storeId && variantId);
}
