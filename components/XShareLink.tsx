import { xLaunchIntent } from "@/lib/product-share";

export function XShareLink({
  siteUrl,
  slug,
  productName,
  description,
  className = "button button-secondary",
  children = "Share on X",
}: {
  siteUrl: string;
  slug: string;
  productName: string;
  description: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const href = xLaunchIntent({ siteUrl, slug, productName, description });
  return <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
}
