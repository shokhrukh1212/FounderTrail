import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { authenticateOwner } from "@/lib/owner-auth";
import { requestOriginIsSameSite } from "@/lib/request-security";
import { removeStoredImage, validateAndStoreImage } from "@/lib/storage";

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/media">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params; const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const form = await request.formData().catch(() => null); const kind = form?.get("kind"); const candidate = form?.get("image");
  if ((kind !== "logo" && kind !== "screenshot") || !(candidate instanceof File) || candidate.size === 0) return NextResponse.json({ error: "Choose a valid image and media type." }, { status: 400 });
  let image; try { image = await validateAndStoreImage(candidate, kind); } catch { return NextResponse.json({ error: "Use a PNG, JPEG, or WebP image within the size limit." }, { status: 400 }); }
  try {
    const saved = await withTransaction(async (client) => {
      if (kind === "logo") {
        const old = await client.query<{ storage_key: string }>(`DELETE FROM product_media WHERE product_id=$1::uuid AND kind='logo' RETURNING storage_key`, [owner.productId]);
        const inserted=await client.query<{id:string}>(`INSERT INTO product_media (product_id,kind,storage_key,public_url,mime_type,byte_size,width,height,position) VALUES ($1::uuid,'logo',$2,$3,$4,$5,$6,$7,0) RETURNING id::text`, [owner.productId,image.storageKey,image.publicUrl,image.mimeType,image.byteSize,image.width,image.height]);
        return { oldKey: old.rows[0]?.storage_key ?? null, id: inserted.rows[0].id, position: 0 };
      }
      const count = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM product_media WHERE product_id=$1::uuid AND kind='screenshot'`, [owner.productId]);
      if ((count.rows[0]?.count ?? 0) >= 4) throw new Error("MEDIA_LIMIT");
      const positions = await client.query<{ position: number }>(`SELECT position FROM product_media WHERE product_id=$1::uuid AND kind='screenshot' ORDER BY position`, [owner.productId]);
      const used = new Set(positions.rows.map((row) => row.position)); let position = 0; while (used.has(position)) position++;
      const inserted=await client.query<{id:string}>(`INSERT INTO product_media (product_id,kind,storage_key,public_url,mime_type,byte_size,width,height,position) VALUES ($1::uuid,'screenshot',$2,$3,$4,$5,$6,$7,$8) RETURNING id::text`, [owner.productId,image.storageKey,image.publicUrl,image.mimeType,image.byteSize,image.width,image.height,position]);
      return { oldKey: null, id: inserted.rows[0].id, position };
    });
    if (saved.oldKey) await removeStoredImage(saved.oldKey);
    return NextResponse.json({ message: "Uploaded.", media: { id: saved.id, kind, url: image.publicUrl, altText: null, position: saved.position } }, { status: 201 });
  } catch (error) { await removeStoredImage(image.storageKey); return NextResponse.json({ error: error instanceof Error && error.message === "MEDIA_LIMIT" ? "A product can have at most four screenshots." : "Could not save the image." }, { status: 400 }); }
}

export async function DELETE(request: Request, context: RouteContext<"/api/owner/products/[slug]/media">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params; const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { mediaId?: unknown } | null;
  if (typeof body?.mediaId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.mediaId)) return NextResponse.json({ error: "Invalid media identifier." }, { status: 400 });
  const removed = await withTransaction(async (client) => {
    const row = await client.query<{ storage_key: string }>(`DELETE FROM product_media WHERE id=$1::uuid AND product_id=$2::uuid RETURNING storage_key`, [body.mediaId, owner.productId]);
    return row.rows[0]?.storage_key ?? null;
  });
  if (!removed) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  await removeStoredImage(removed);
  return NextResponse.json({ message: "Removed." });
}
