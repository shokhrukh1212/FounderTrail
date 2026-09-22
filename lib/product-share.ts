const X_POST_LIMIT = 280;
const X_SHORT_URL_LENGTH = 23;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * X (and LinkedIn, Slack…) cache a link's card by URL, image included, for days. A link
 * shared before the current share-image design would keep showing the old card, so every
 * link that goes into a post carries this version, and the page's og:image does too.
 * Bump it whenever the product share image changes. Canonical URLs stay unversioned.
 */
export const SHARE_CARD_VERSION = "2";

/** The product URL to put in a post: the canonical page plus the share-card version. */
export function sharedProductUrl(siteUrl: string, slug: string): string {
  const url = new URL(canonicalProductUrl(siteUrl, slug));
  url.searchParams.set("v", SHARE_CARD_VERSION);
  return url.toString();
}

/** The product's share image, versioned with the share links so both refresh together. */
export function productShareImageUrl(siteUrl: string, slug: string): string {
  const url = new URL(`/product/${encodeURIComponent(slug)}/opengraph-image`, `${siteUrl.replace(/\/+$/, "")}/`);
  url.searchParams.set("v", SHARE_CARD_VERSION);
  return url.toString();
}

export function canonicalProductUrl(siteUrl: string, slug: string): string {
  return new URL(`/product/${encodeURIComponent(slug)}`, `${siteUrl.replace(/\/+$/, "")}/`).toString();
}

export function productLaunchUrl(siteUrl: string, slug: string): string {
  const url = new URL(canonicalProductUrl(siteUrl, slug));
  url.search = new URLSearchParams({
    v: SHARE_CARD_VERSION,
    ref: slug,
    utm_source: "x",
    utm_medium: "social",
    utm_campaign: "founder_launch",
    utm_content: slug,
  }).toString();
  return url.toString();
}

export function launchPostText(productName: string, description = "", foundingProductCount = 21): string {
  void description; void foundingProductCount;
  const fullName = productName.trim().replace(/\s+/g, " ");
  const heading = `I’m building ${fullName} and sharing its progress on FounderTrail.`;
  const closing = "See what it does and follow along:";
  const withoutDescription = `${heading}\n\n${closing}`;
  const textBudget = X_POST_LIMIT - X_SHORT_URL_LENGTH - 1;
  if (codePointLength(withoutDescription) <= textBudget) return withoutDescription;
  // The product name is never truncated. If an unusually long valid name leaves no
  // room for the full surrounding copy, retain the name and the required CTA line.
  return `${fullName}\n\n${closing}`;
}

/**
 * The product page's Share on X draft. A visitor is not the founder, so the text makes no
 * claim about who is posting, adds no slogan, metrics or hashtags, and carries the link
 * exactly once — X appends the `url` parameter itself.
 */
export function productShareText(shortProductName: string): string {
  const name = shortProductName.replace(/\s+/g, " ").trim();
  return `Discover ${name} on FounderTrail.`;
}

function isLocalOrigin(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * A localhost site URL is fine while developing but must never end up inside a real post.
 * If SITE_URL is still local on a deployment, the platform's own production hostname is
 * used instead of publishing an address nobody else can open.
 */
export function publicShareOrigin(siteUrl: string): string {
  const trimmed = siteUrl.replace(/\/+$/, "");
  if (!isLocalOrigin(trimmed)) return trimmed;
  const deployment = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (!deployment) return trimmed;
  return `https://${deployment.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
}

/**
 * X's supported web intent for a product page. It opens the composer so the visitor can
 * edit before posting; nothing is posted automatically and no X credentials are involved.
 */
export function xProductShareIntent(input: { siteUrl: string; slug: string; shortProductName: string }): string {
  const origin = publicShareOrigin(input.siteUrl);
  const parameters = new URLSearchParams({
    text: productShareText(input.shortProductName),
    url: sharedProductUrl(origin, input.slug),
  });
  return `https://x.com/intent/tweet?${parameters.toString()}`;
}

export function validXHandle(value: string | null | undefined): string | null {
  const handle = (value ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(handle) ? handle : null;
}

export function xLaunchIntent(input: { siteUrl: string; slug: string; productName: string; description?: string; foundingProductCount?: number; bidIndexHandle?: string | null }): string {
  const publicUrl = productLaunchUrl(input.siteUrl, input.slug);
  const parameters = new URLSearchParams({
    text: launchPostText(input.productName, input.description, input.foundingProductCount),
    url: publicUrl,
  });
  const handle=validXHandle(input.bidIndexHandle);if(handle)parameters.set("via",handle);
  return `https://x.com/intent/tweet?${parameters.toString()}`;
}

export function trackedXShareUrl(siteUrl: string, slug: string, source: "owner" | "product" | "email" | "admin" | "unknown" = "unknown"): string {
  const url = new URL(`/share/x/${encodeURIComponent(slug)}`, `${siteUrl.replace(/\/+$/, "")}/`);
  url.searchParams.set("source", source);
  return url.toString();
}
