import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
import { query } from "@/lib/db";
import { displayProductName, publicText } from "@/lib/display-text";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The FounderTrail mark, read once from the project root (see the Next.js opengraph-image
// docs, "Using Node.js runtime with local assets").
const logoSrc = `data:image/png;base64,${await readFile(join(process.cwd(), "public/brand/logo-256.png"), "base64")}`;

/**
 * X's card crawler gives up on a slow image and caches the card without it. ImageResponse
 * defaults to `max-age=0` and a streamed body, so every crawl rendered from scratch. The
 * card is cached at the CDN instead, refreshed in the background after an hour, and sent
 * with its length like a static file. Share links carry SHARE_CARD_VERSION, so a design
 * change never waits on this cache.
 */
const CACHE_CONTROL = "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400";

export default async function ProductOpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Only the two lines the card prints: the full product query ranks every listing.
  const rows = await query<{ name: string; short_name: string | null; tagline: string }>(
    `SELECT name, short_name, tagline FROM products
      WHERE slug = $1 AND status = 'published' AND ($2::boolean OR NOT is_demo) LIMIT 1`,
    [slug, process.env.NODE_ENV !== "production"],
  );
  const product = rows[0];
  const name = product ? displayProductName(product.name, product.short_name) : "Startup";
  const tagline = product ? publicText(product.tagline) : "Discover what founders build next.";
  const image = new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "72px", background: "#fffdfa", color: "#182230", fontFamily: "Arial, sans-serif" }}><div style={{ display: "flex", alignItems: "center", gap: "18px", fontSize: 30, fontWeight: 700 }}><img src={logoSrc} width={48} height={48} alt="" />{brand.displayName}</div><div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "1000px" }}><div style={{ fontSize: 72, lineHeight: 1.02, fontWeight: 800, letterSpacing: "-3px" }}>{name}</div><div style={{ fontSize: 32, lineHeight: 1.3, color: "#5f6b7a" }}>{tagline}</div></div><div style={{ display: "flex", fontSize: 24, color: "#ff6154", fontWeight: 700 }}>Follow what they build next.</div></div>, size);
  const png = await image.arrayBuffer();
  return new Response(png, {
    headers: {
      "content-type": "image/png",
      "content-length": String(png.byteLength),
      // An unknown or unpublished slug still gets the generic card, but only briefly.
      "cache-control": product ? CACHE_CONTROL : "public, max-age=60, s-maxage=60",
    },
  });
}
