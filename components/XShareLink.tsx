import { trackedXShareUrl } from "@/lib/product-share";

export function XShareLink({
  siteUrl,
  slug,
  productName,
  description,
  className = "button button-secondary",
  children = "Share on X",
  source = "product",
}: {
  siteUrl: string;
  slug: string;
  productName: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
  source?: "owner" | "product" | "email" | "admin" | "unknown";
}) {
  void productName; void description;
  const href = trackedXShareUrl(siteUrl, slug, source);
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}
