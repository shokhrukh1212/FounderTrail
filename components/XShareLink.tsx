import { trackedXShareUrl } from "@/lib/product-share";

/**
 * Share on X. The link goes through /share/x/[slug], which records the intent and then
 * redirects to X's web intent composer with the draft already filled in — so the visitor
 * edits and posts it themselves. The draft text is chosen server side from `source`:
 * product pages get the neutral "Discover <name> on FounderTrail." draft, while the
 * founder's own dashboard keeps its first-person launch draft.
 */
export function XShareLink({
  siteUrl,
  slug,
  productName,
  className = "button button-secondary",
  children = "Share on X",
  source = "product",
}: {
  siteUrl: string;
  slug: string;
  productName: string;
  className?: string;
  children?: React.ReactNode;
  source?: "owner" | "product" | "email" | "admin" | "unknown";
}) {
  const href = trackedXShareUrl(siteUrl, slug, source);
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Share ${productName} on X`}>{children}</a>;
}
