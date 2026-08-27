import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { newBidIndexOwnerToken, hashBidIndexOwnerToken, ownerCookieName, ownerCookieOptions } from "@/lib/bidindex-owner";
import { config } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { validateProductSubmission } from "@/lib/product-validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { networkHash, requestOriginIsSameSite } from "@/lib/request-security";
import { firstFreeSlug, slugify } from "@/lib/slug";
import { removeStoredImage, validateAndStoreImage, type StoredImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

async function uniqueSlug(client: PoolClient, name: string): Promise<string> {
  const base = slugify(name);
  const rows = await client.query<{ slug: string }>(`SELECT slug FROM products WHERE slug = $1 OR slug LIKE $2`, [base, `${base}-%`]);
  return firstFreeSlug(base, rows.rows.map((row) => row.slug));
}

function files(form: FormData, name: string): File[] {
  return form.getAll(name).filter((value): value is File => value instanceof File && value.size > 0);
}

export async function POST(request: Request) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Expected a multipart form." }, { status: 415 });
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid form data." }, { status: 400 }); }
  const validated = validateProductSubmission(form);
  if (!validated.ok) return NextResponse.json({ error: validated.error, field: validated.field }, { status: 400 });
  const logoFiles = files(form, "logo");
  const screenshotFiles = files(form, "screenshots");
  if (logoFiles.length > 1 || screenshotFiles.length > 4) return NextResponse.json({ error: "Upload one logo and at most four screenshots." }, { status: 400 });
  const stored: Array<StoredImage & { kind: "logo" | "screenshot"; position: number }> = [];
  try {
    if (logoFiles[0]) stored.push({ ...(await validateAndStoreImage(logoFiles[0], "logo")), kind: "logo", position: 0 });
    for (const [position, file] of screenshotFiles.entries()) stored.push({ ...(await validateAndStoreImage(file, "screenshot")), kind: "screenshot", position });
  } catch (error) {
    await Promise.all(stored.map((image) => removeStoredImage(image.storageKey)));
    const code = error instanceof Error ? error.message : "UPLOAD_FAILED";
    return NextResponse.json({ error: code === "UPLOAD_STORAGE_UNAVAILABLE" ? "Uploads are unavailable in this environment." : "Use PNG, JPEG, or WebP images within the size limits." }, { status: 400 });
  }
  const ownerToken = newBidIndexOwnerToken();
  const ownerHash = hashBidIndexOwnerToken(ownerToken);
  try {
    const created = await withTransaction(async (client) => {
      const allowed = await consumeRateLimit(client, { action: "submission", keyHash: networkHash(request, "submission"), limit: 5, windowSeconds: 3600 });
      if (!allowed) throw new Error("RATE_LIMITED");
      const duplicate = await client.query(`SELECT 1 FROM products WHERE normalized_domain = $1`, [validated.value.normalizedDomain]);
      if (duplicate.rows[0]) throw new Error("DOMAIN_EXISTS");
      const categoryRows = await client.query<{ id: string; slug: string }>(`SELECT id::text, slug FROM categories WHERE slug = ANY($1::text[])`, [validated.value.categories]);
      if (categoryRows.rowCount !== validated.value.categories.length) throw new Error("INVALID_CATEGORY");
      const slug = await uniqueSlug(client, validated.value.name);
      const product = await client.query<{ id: string }>(
        `INSERT INTO products
           (slug, website_url, normalized_domain, name, tagline, description, founder_name,
            contact_email, founder_social_handle, launch_at, bidding_mechanism,
            minimum_bid_minor, current_bid_minor, bid_currency, public_analytics_url, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending')
         RETURNING id::text`,
        [slug, validated.value.websiteUrl, validated.value.normalizedDomain, validated.value.name,
         validated.value.tagline, validated.value.description, validated.value.founderName,
         validated.value.contactEmail, validated.value.founderSocialHandle, validated.value.launchAt,
         validated.value.biddingMechanism, validated.value.minimumBidMinor, validated.value.currentBidMinor,
         validated.value.bidCurrency, validated.value.publicAnalyticsUrl],
      );
      const productId = product.rows[0].id;
      await client.query(`INSERT INTO product_owner_credentials (product_id, token_hash) VALUES ($1::uuid,$2)`, [productId, ownerHash]);
      for (const [position, category] of validated.value.categories.entries()) {
        const categoryId = categoryRows.rows.find((row) => row.slug === category)?.id;
        await client.query(`INSERT INTO product_categories (product_id, category_id, position) VALUES ($1::uuid,$2::bigint,$3)`, [productId, categoryId, position]);
      }
      for (const image of stored) {
        await client.query(
          `INSERT INTO product_media
             (product_id, kind, storage_key, public_url, mime_type, byte_size, width, height, position)
           VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [productId, image.kind, image.storageKey, image.publicUrl, image.mimeType, image.byteSize, image.width, image.height, image.position],
        );
      }
      return { id: productId, slug };
    });
    const localManagementUrl = `${config.siteUrl}/manage/${created.slug}#token=${ownerToken}`;
    const response = NextResponse.json({
      product: { slug: created.slug, status: "pending" },
      managementUrl: process.env.NODE_ENV === "production" ? undefined : localManagementUrl,
      message: "Submission received for moderation.",
    }, { status: 201 });
    response.cookies.set(ownerCookieName(created.id), ownerToken, ownerCookieOptions);
    return response;
  } catch (error) {
    await Promise.all(stored.map((image) => removeStoredImage(image.storageKey)));
    const code = error instanceof Error ? error.message : "";
    if (code === "DOMAIN_EXISTS") return NextResponse.json({ error: "A product from this domain has already been submitted." }, { status: 409 });
    if (code === "RATE_LIMITED") return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
    if (code === "INVALID_CATEGORY") return NextResponse.json({ error: "Choose valid categories." }, { status: 400 });
    console.error("product submission failed", code || "unknown error");
    return NextResponse.json({ error: "Could not save the submission." }, { status: 500 });
  }
}
