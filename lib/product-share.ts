const X_POST_LIMIT = 280;
const X_SHORT_URL_LENGTH = 23;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

export function canonicalProductUrl(siteUrl: string, slug: string): string {
  return new URL(`/product/${encodeURIComponent(slug)}`, `${siteUrl.replace(/\/+$/, "")}/`).toString();
}

export function productLaunchUrl(siteUrl: string, slug: string): string {
  const url = new URL(canonicalProductUrl(siteUrl, slug));
  url.search = new URLSearchParams({
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
  const heading = `My product, ${fullName}, is one of the first 21 products on BidIndex 🚀`;
  const closing = "Discover it and support the launch:";
  const withoutDescription = `${heading}\n\n${closing}`;
  const textBudget = X_POST_LIMIT - X_SHORT_URL_LENGTH - 1;
  if (codePointLength(withoutDescription) <= textBudget) return withoutDescription;
  // The product name is never truncated. If an unusually long valid name leaves no
  // room for the full surrounding copy, retain the name and the required CTA line.
  return `${fullName}\n\n${closing}`;
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
