import { NextResponse } from "next/server";
import { authenticateProOwner } from "@/lib/pro-access";
import { query } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";
import { removeStoredImage, validateAndStoreImage } from "@/lib/storage";

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/launch-kit/assets">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const access = await authenticateProOwner(request, slug);
  if (!access) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  if (access.entitlementStatus !== "active") return NextResponse.json({ error: "An active Pro upgrade is required to upload launch-kit images." }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind");
  const candidate = form?.get("image");
  if ((kind !== "logo" && kind !== "screenshot") || !(candidate instanceof File) || candidate.size === 0) return NextResponse.json({ error: "Choose a logo or screenshot." }, { status: 400 });
  let image;
  try { image = await validateAndStoreImage(candidate, "launch-kit"); }
  catch { return NextResponse.json({ error: "Use a PNG, JPEG, or WebP image within 5 MB and 24 megapixels." }, { status: 400 }); }
  try {
    const rows = await query<{ id: string }>(
      `INSERT INTO pro_launch_kit_assets(product_id,uploaded_by,kind,storage_key,mime_type,byte_size,width,height)
       VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`,
      [access.productId, access.userId, kind, image.storageKey, image.mimeType, image.byteSize, image.width, image.height],
    );
    const id = rows[0].id;
    return NextResponse.json({ asset: { id, kind, source: `asset:${id}`, url: `/api/owner/products/${encodeURIComponent(slug)}/launch-kit/assets/${id}`, label: `Private ${kind}` } }, { status: 201 });
  } catch {
    await removeStoredImage(image.storageKey);
    return NextResponse.json({ error: "Could not save the launch-kit image." }, { status: 500 });
  }
}
