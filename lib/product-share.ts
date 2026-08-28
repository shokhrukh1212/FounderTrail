const X_POST_LIMIT = 280;
const X_SHORT_URL_LENGTH = 23;

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function wordSafeDescription(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (maxLength < 2 || !normalized) return "";
  if (codePointLength(normalized) <= maxLength) return normalized;
  const candidate = Array.from(normalized).slice(0, Math.max(1, maxLength - 1)).join("");
  const boundary = candidate.lastIndexOf(" ");
  const trimmed = (boundary >= Math.floor(candidate.length * 0.55) ? candidate.slice(0, boundary) : candidate).trim();
  return trimmed ? `${trimmed}…` : "";
}

function shortProductName(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  const delimiter = normalized.search(/\s(?:-|—)\s/);
  return delimiter > 0 ? normalized.slice(0, delimiter).trim() : normalized;
}

export function canonicalProductUrl(siteUrl: string, slug: string): string {
  return new URL(`/product/${encodeURIComponent(slug)}`, `${siteUrl.replace(/\/+$/, "")}/`).toString();
}

export function productLaunchUrl(siteUrl: string, slug: string): string {
  const url = new URL(canonicalProductUrl(siteUrl, slug));
  url.search = new URLSearchParams({
    utm_source: "x",
    utm_medium: "social",
    utm_campaign: "founder_launch",
    utm_content: "approval_share",
    share_version: "2",
  }).toString();
  return url.toString();
}

export function launchPostText(productName: string, description: string): string {
  const fullName = productName.trim().replace(/\s+/g, " ");
  const launchName = shortProductName(fullName);
  const heading = `My product, ${launchName} is now live on BidIndex 🚀`;
  const nameParagraph = launchName === fullName ? "" : `\n\n${fullName}`;
  const closing = "Check it out and support the launch:";
  const withoutDescription = `${heading}${nameParagraph}\n\n${closing}`;
  const textBudget = X_POST_LIMIT - X_SHORT_URL_LENGTH - 1;
  const descriptionBudget = textBudget - codePointLength(withoutDescription) - 2;
  const shortened = wordSafeDescription(description, descriptionBudget);
  return shortened ? `${heading}${nameParagraph}\n\n${shortened}\n\n${closing}` : withoutDescription;
}

export function xLaunchIntent(input: { siteUrl: string; slug: string; productName: string; description: string }): string {
  const publicUrl = productLaunchUrl(input.siteUrl, input.slug);
  const parameters = new URLSearchParams({
    text: launchPostText(input.productName, input.description),
    url: publicUrl,
  });
  return `https://x.com/intent/tweet?${parameters.toString()}`;
}
