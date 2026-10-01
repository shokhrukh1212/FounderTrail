import type { Metadata } from "next";
import { brandCopy } from "./brand";
import { config } from "./config";

export const siteSocialImage = {
  url: "/brand/og.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: `${config.siteName} — ${brandCopy.line}`,
};

export const siteOpenGraph = {
  type: "website" as const,
  siteName: config.siteName,
  locale: "en_US",
  title: brandCopy.metaTitle,
  description: brandCopy.metaDescription,
  images: [siteSocialImage],
};

export const siteTwitter = {
  card: "summary_large_image" as const,
  title: brandCopy.metaTitle,
  description: brandCopy.metaDescription,
  images: [siteSocialImage],
};

// Next replaces nested metadata fields rather than deeply merging them. Keep
// the shared image when giving each public page its own URL and social copy.
export function publicPageMetadata(path: string, title: string, description: string, absoluteTitle = false): Metadata {
  const canonical = new URL(path, config.siteUrl).toString();
  const socialTitle = absoluteTitle ? title : `${title} · ${config.siteName}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical },
    openGraph: { ...siteOpenGraph, url: canonical, title: socialTitle, description },
    twitter: { ...siteTwitter, title: socialTitle, description },
  };
}

export type HomeSearchParams = {
  view?: string; q?: string; category?: string; pricing?: string; sort?: string; page?: string;
};

export function discoveryPageMetadata(params: HomeSearchParams): Metadata {
  const view = params.view === "discover" || params.view === "updates" ? params.view : "this_week";
  const query = new URLSearchParams();
  if (view !== "this_week") query.set("view", view);
  // Filters and alternate ordering remain usable, but don't create an
  // unlimited set of indexable variations of the same directory.
  if (view !== "updates") {
    if (params.category) query.set("category", params.category);
    if (params.sort === "newest") query.set("sort", "newest");
    if (view === "discover") {
      if (params.q) query.set("q", params.q);
      if (params.pricing) query.set("pricing", params.pricing);
    }
  }
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  if (page > 1) query.set("page", String(page));
  const path = query.size ? `/?${query}` : "/";
  const title = view === "discover" ? "All startups" : view === "updates" ? "Founder updates" : brandCopy.metaTitle;
  const description = view === "updates" ? brandCopy.updatesIntroduction : brandCopy.metaDescription;
  const metadata = publicPageMetadata(path, title, description, view === "this_week");
  if (query.has("q") || query.has("category") || query.has("pricing") || query.has("sort")) {
    metadata.robots = { index: false, follow: true };
  }
  return metadata;
}
