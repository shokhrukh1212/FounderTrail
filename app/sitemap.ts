import type { MetadataRoute } from "next";
import { config } from "@/lib/config";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await query<{ slug: string; updated_at: Date }>(
    `SELECT slug,updated_at FROM products WHERE status='published' AND ($1::boolean OR NOT is_demo) ORDER BY updated_at DESC`,
    [process.env.NODE_ENV !== "production"],
  );
  return [
    { url: config.siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${config.siteUrl}/?view=discover`, changeFrequency: "daily", priority: 0.9 },
    { url: `${config.siteUrl}/?view=updates`, changeFrequency: "daily", priority: 0.7 },
    { url: `${config.siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${config.siteUrl}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${config.siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${config.siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...products.map((product) => ({ url: `${config.siteUrl}/product/${encodeURIComponent(product.slug)}`, lastModified: new Date(product.updated_at), changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
