import type { ProductPricing } from "./product-pricing";

export type AdminProductSummary = {
  id: string;
  slug: string;
  /** The name exactly as submitted. */
  name: string;
  /** The reviewed short brand name, when one has been set. */
  shortName: string | null;
  /** What the public sees today. */
  displayName: string;
  websiteUrl: string;
  normalizedDomain: string;
  categories: Array<{ slug: string; name: string }>;
  /** Still on Other, or flagged by the category reset as needing classification. */
  needsClassification: boolean;
  founderName: string | null;
  contactEmail: string;
  founderSocialHandle: string | null;
  status: string;
  ownershipStatus: "unclaimed" | "pending" | "disputed" | "claimed";
  launchStatus: string;
  launchWeekStart: string | null;
  recentActivityAt: string;
  verificationStatus: "verified" | "domain_verified" | "not_verified";
  upvotes: number;
  productViews: number;
  referredVisitors: number;
  submittedAt: string;
  approvedAt: string | null;
  approvalEmailStatus: string;
  approvalEmailSentAt: string | null;
  logoUrl: string | null;
};

export type AdminProductDetail = {
  product: {
    id: string;
    slug: string;
    name: string;
    shortName: string | null;
    displayName: string;
    tagline: string;
    description: string | null;
    websiteUrl: string;
    submittedUrl: string;
    normalizedDomain: string;
    founderName: string | null;
    contactEmail: string;
    founderSocialHandle: string | null;
    status: string;
    launchDate: string;
    submittedAt: string;
    publishedAt: string | null;
    approvedAt: string | null;
    consentAt: string | null;
    consentVersion: string | null;
    categories: Array<{ slug: string; name: string }>;
    categoryProvenance: string | null;
    needsClassification: boolean;
    pricing: ProductPricing;
    pricingSource: "founder" | "admin" | null;
    pricingConfirmedAt: string | null;
    isOpenSource: boolean;
    /** Machine-inferred pricing, kept for review only. Never published as-is. */
    legacyPricing: { model: string | null; startingPriceMinor: number | null; currency: string | null; provenance: string | null; evidenceUrl: string | null; checkedAt: string | null } | null;
    domainOverrideApproved: boolean;
    foundingPosition: number | null;
    biddingMechanism: string | null;
    minimumBidMinor: number | null;
    currentBidMinor: number | null;
    bidCurrency: string | null;
    publicAnalyticsUrl: string | null;
    dataDisclosure: string | null;
  };
  email: {
    marketingOptedIn: boolean;
    marketingUnsubscribedAt: string | null;
    suppressions: string[];
    approvalStatus: string;
    approvalSentAt: string | null;
    approvalLastAttemptAt: string | null;
    approvalFailure: string | null;
  };
  verification: {
    domainStatus: string;
    allowedDomain: string | null;
    verificationMethod: string | null;
    domainVerifiedAt: string | null;
    badgeStatus: string;
    badgeInstalledAt: string | null;
    productVerifiedAt: string | null;
  };
  ownerCredential: { createdAt: string | null; rotatedAt: string | null };
  metadata: {
    originalUrl: string;
    finalUrl: string;
    fetchStatus: string;
    extractedName: string | null;
    extractedTagline: string | null;
    extractedLogoUrl: string | null;
    extractedImageUrl: string | null;
    fetchedAt: string | null;
  } | null;
  media: Array<{ id: string; kind: string; url: string; mimeType: string; byteSize: number; width: number | null; height: number | null; altText: string | null; position: number }>;
  moderation: Array<{ fromStatus: string; toStatus: string; reason: string | null; createdAt: string }>;
  metrics: { upvotes: number; productViews: number; referredVisitors: number; outboundClicks: number };
};
