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
  sponsorshipsEnabled: process.env.SPONSORSHIPS_ENABLED === "true",
  sponsorship: {
    priceMinor: 900,
    currency: "USD" as const,
    durationHours: 168,
    holdMinutes: 15,
    minimumLeadMinutes: 20,
  },
  dodoPayments: {
    apiKey: process.env.DODO_PAYMENTS_API_KEY ?? "",
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? "",
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" as const : "test_mode" as const,
    businessId: process.env.DODO_PAYMENTS_BUSINESS_ID ?? "",
    sponsorProductId: process.env.DODO_SPONSOR_PRODUCT_ID ?? "",
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

export function isDodoConfigured(): boolean {
  const dodo = config.dodoPayments;
  return config.sponsorshipsEnabled && Boolean(dodo.apiKey && dodo.webhookKey && dodo.businessId && dodo.sponsorProductId);
}

export function isLemonSqueezyConfigured(): boolean {
  const { apiKey, storeId, variantId } = config.lemonSqueezy;
  return !!(apiKey && storeId && variantId);
}
