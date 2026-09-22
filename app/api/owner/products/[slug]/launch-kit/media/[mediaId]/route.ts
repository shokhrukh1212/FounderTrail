import { NextResponse } from "next/server";
import sharp from "sharp";
import { authenticateProOwner } from "@/lib/pro-access";
import { query } from "@/lib/db";
import { readStoredImage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request, context: RouteContext<"/api/owner/products/[slug]/launch-kit/media/[mediaId]">) {
  const { slug, mediaId } = await context.params;
  const access = await authenticateProOwner(request, slug);
  if (!access) return new NextResponse(null, { status: 404 });
  const rows = await query<{ storage_key: string }>(`SELECT storage_key FROM product_media WHERE id=$1::uuid AND product_id=$2::uuid`, [mediaId, access.productId]).catch(() => []);
  if (!rows[0]) return new NextResponse(null, { status: 404 });
  const stored = await readStoredImage(rows[0].storage_key);
  if (!stored) return new NextResponse(null, { status: 404 });
  try {
    const png = await sharp(stored.bytes, { limitInputPixels: 24_000_000 }).rotate().png().toBuffer();
    return new NextResponse(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" } });
  } catch { return new NextResponse(null, { status: 422 }); }
}
