import { NextResponse } from "next/server";
import sharp from "sharp";
import { authenticateProOwner } from "@/lib/pro-access";
import { query } from "@/lib/db";
import { readStoredImage } from "@/lib/storage";
import { fetchPinnedPublic, fetchPublicLogo, googleFaviconUrl } from "@/lib/submission-metadata";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Approved listing media for the launch-kit canvas. It is served from our own origin so
 * the canvas stays exportable. These images are already public on the product page, so
 * when the configured storage driver cannot read the object (a local driver pointed at
 * data uploaded to S3, for instance) the stored public URL is fetched instead, through
 * the same SSRF-safe transport used for submissions.
 */
async function listingImageBytes(storageKey: string, publicUrl: string): Promise<Buffer | null> {
  const stored = await readStoredImage(storageKey);
  if (stored) return stored.bytes;
  try {
    const remote = await fetchPinnedPublic(publicUrl, "image/png,image/jpeg,image/webp", MAX_BYTES, 2);
    const mime = remote.contentType.split(";", 1)[0].trim().toLowerCase();
    return ["image/png", "image/jpeg", "image/webp"].includes(mime) ? remote.bytes : null;
  } catch {
    return null;
  }
}

/**
 * The logo read from the startup's own website, for listings that never uploaded one: the
 * icon found at submission (an .ico is reduced to its largest embedded PNG), then Google's
 * favicon service. It is validated exactly as the public logo proxy validates it (passive
 * SVG only) and rasterised here, so the canvas always receives a same-origin PNG.
 */
async function listingLogoPng(productId: string): Promise<Buffer | null> {
  const rows = await query<{ logo_url: string | null; website_url: string }>(`SELECT sm.extracted_logo_url AS logo_url,p.website_url FROM products p LEFT JOIN product_submission_metadata sm ON sm.product_id=p.id WHERE p.id=$1::uuid`, [productId]).catch(() => []);
  if (!rows[0]) return null;
  const logo = await fetchPublicLogo([rows[0].logo_url, googleFaviconUrl(rows[0].website_url)]);
  if (!logo) return null;
  try {
    return await sharp(logo.bytes, { density: 384, limitInputPixels: 24_000_000 })
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, withoutEnlargement: logo.contentType !== "image/svg+xml" })
      .png().toBuffer();
  } catch {
    return null;
  }
}

export async function GET(request: Request, context: RouteContext<"/api/owner/products/[slug]/launch-kit/media/[mediaId]">) {
  const { slug, mediaId } = await context.params;
  const access = await authenticateProOwner(request, slug);
  if (!access) return new NextResponse(null, { status: 404 });
  if (mediaId === "listing-logo") {
    const png = await listingLogoPng(access.productId);
    return png
      ? new NextResponse(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } })
      : new NextResponse(null, { status: 404 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(mediaId)) return new NextResponse(null, { status: 404 });
  const rows = await query<{ storage_key: string; public_url: string }>(`SELECT storage_key,public_url FROM product_media WHERE id=$1::uuid AND product_id=$2::uuid`, [mediaId, access.productId]).catch(() => []);
  if (!rows[0]) return new NextResponse(null, { status: 404 });
  const bytes = await listingImageBytes(rows[0].storage_key, rows[0].public_url);
  if (!bytes) return new NextResponse(null, { status: 404 });
  try {
    // 2000px covers the 2x export with room to spare; WebP keeps the transfer small.
    const image = await sharp(bytes, { limitInputPixels: 24_000_000 }).rotate().resize({ width: 2000, withoutEnlargement: true }).webp({ quality: 92 }).toBuffer();
    return new NextResponse(new Uint8Array(image), { headers: { "content-type": "image/webp", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
  } catch { return new NextResponse(null, { status: 422 }); }
}
