import type { MetadataRoute } from "next";
import { config } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/claim/", "/following", "/manage/", "/my-products", "/promote/", "/settings", "/sign-in"] },
    sitemap: `${config.siteUrl}/sitemap.xml`,
  };
}
