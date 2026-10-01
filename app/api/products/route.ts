import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseLaunchChoice, productIdentity } from "@/lib/launch-policy";
import { saveLaunch } from "@/lib/launch-service";
import { insertFunnelEvent } from "@/lib/analytics";
import type { PoolClient } from "pg";
import { currentUserFromHeaders } from "@/lib/auth";
import { newBidIndexOwnerToken, hashBidIndexOwnerToken } from "@/lib/bidindex-owner";
import { config } from "@/lib/config";
import { query, withTransaction } from "@/lib/db";
import { ensureFounderPreference } from "@/lib/email-preferences";
import { validateProductSubmission } from "@/lib/product-validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, networkHash, requestOriginIsSameSite } from "@/lib/request-security";
import { firstFreeSlug, slugify } from "@/lib/slug";
import { removeStoredImage, validateAndStoreImage, type StoredImage } from "@/lib/storage";
import { fetchPinnedPublic, fetchSubmissionMetadata, verifyMetadata } from "@/lib/submission-metadata";
import { applyProductCategories, InvalidCategorySelection } from "@/lib/product-categories";

export const dynamic = "force-dynamic";

async function uniqueSlug(client: PoolClient, name: string): Promise<string> {
  const base = slugify(name);
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`product-slug:${base}`]);
  const rows = await client.query<{ slug: string }>(`SELECT slug FROM products WHERE slug = $1 OR slug LIKE $2`, [base, `${base}-%`]);
  return firstFreeSlug(base, rows.rows.map((row) => row.slug));
}

function files(form: FormData, name: string): File[] {
  return form.getAll(name).filter((value): value is File => value instanceof File && value.size > 0);
}

export async function POST(request: Request) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const user = await currentUserFromHeaders(request.headers);
  if (!user) return NextResponse.json({ error: "Sign in is required to submit a startup." }, { status: 401 });
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Expected a multipart form." }, { status: 415 });
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.json({ error: "Invalid form data." }, { status: 400 }); }
  const requestedStatus = form.get("submissionStatus") === "draft" ? "draft" : "published";
  const validated = validateProductSubmission(form, { draft: requestedStatus === "draft" });
  if (!validated.ok) return NextResponse.json({ error: validated.error, field: validated.field }, { status: 400 });
  const submissionKey = String(form.get("submissionKey") ?? "");
  if (submissionKey && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(submissionKey)) return NextResponse.json({ error: "Invalid submission key." }, { status: 400 });
  const replay = submissionKey ? await query<{ slug: string; status: string }>(`SELECT slug,status FROM products WHERE created_by_user_id=$1 AND submission_key=$2::uuid`, [user.id, submissionKey]) : [];
  if (replay[0]) return NextResponse.json({ product: replay[0], managementUrl: `${config.siteUrl}/manage/${replay[0].slug}/launch` });
  const identity = productIdentity(validated.value.websiteUrl);
  try { if (requestedStatus !== "draft") parseLaunchChoice(form.get("launchChoice"), form.get("launchStartsAt")); }
  catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  const logoFiles = files(form, "logo");
  const screenshotFiles = files(form, "screenshots");
  if (logoFiles.length > 1) return NextResponse.json({ error: "Choose one logo only.", field: "logo" }, { status: 400 });
  if (screenshotFiles.length > 4) return NextResponse.json({ error: "Choose up to four screenshots.", field: "screenshots" }, { status: 400 });
  const stored: Array<StoredImage & { kind: "logo" | "screenshot"; position: number; altText?: string | null }> = [];
  // A missing, expired, or www-normalized client token must not silently lose
  // a site's public logo. Re-fetch with the same SSRF-safe transport; failure
  // still returns editable fallback metadata and never blocks submission.
  const submittedMetadata = verifyMetadata(validated.value.metadataToken, validated.value.websiteUrl)
    ?? await fetchSubmissionMetadata(validated.value.websiteUrl);
  try {
    if (logoFiles[0]) stored.push({ ...(await validateAndStoreImage(logoFiles[0], "logo")), kind: "logo", position: 0 });
    else if(submittedMetadata?.logoUrl){try{const remote=await fetchPinnedPublic(submittedMetadata.logoUrl,"image/png,image/jpeg,image/webp",2*1024*1024,2);const mime=remote.contentType.split(";",1)[0];if(!["image/png","image/jpeg","image/webp"].includes(mime))throw new Error("UNSUPPORTED_IMAGE_TYPE");const ext=mime==="image/png"?"png":mime==="image/jpeg"?"jpg":"webp";const bytes=new ArrayBuffer(remote.bytes.length);new Uint8Array(bytes).set(remote.bytes);const remoteFile=new File([bytes],`metadata-logo.${ext}`,{type:mime});stored.push({...(await validateAndStoreImage(remoteFile,"logo")),kind:"logo",position:0});}catch{/* A metadata image failure never blocks manual submission. */}}
    const screenshotAlts = form.getAll("screenshotAlt").map((entry) => (typeof entry === "string" ? entry.trim().slice(0, 240) : ""));
    for (const [position, file] of screenshotFiles.entries()) stored.push({ ...(await validateAndStoreImage(file, "screenshot")), kind: "screenshot", position, altText: screenshotAlts[position] || null });
  } catch (error) {
    await Promise.all(stored.map((image) => removeStoredImage(image.storageKey)));
    const code = error instanceof Error ? error.message : "UPLOAD_FAILED";
    return NextResponse.json({ error: code === "UPLOAD_STORAGE_UNAVAILABLE" ? "Uploads are unavailable in this environment." : "Use PNG, JPEG, or WebP images within the size limits." }, { status: 400 });
  }
  const ownerToken = newBidIndexOwnerToken();
  const ownerHash = hashBidIndexOwnerToken(ownerToken);
  try {
    const created = await withTransaction(async (client) => {
      if (submissionKey) await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`submission-key:${user.id}:${submissionKey}`]);
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, [`submission:${identity}`]);
      if (submissionKey) {
        const existing = await client.query<{ id: string; slug: string; status: string }>(`SELECT id::text,slug,status FROM products WHERE created_by_user_id=$1 AND submission_key=$2::uuid`, [user.id, submissionKey]);
        if (existing.rows[0]) return { ...existing.rows[0], replayed: true };
      }
      // Exact product URL identity preserves separate products on shared hosts.
      // Check historical rows too, including ambiguous duplicates excluded from the registry.
      const candidates = await client.query<{ id: string; slug: string; status: string; website_url: string; allowed: boolean }>(`SELECT p.id::text,p.slug,p.status,p.website_url,EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2) AS allowed FROM products p WHERE normalized_domain=$1`, [validated.value.normalizedDomain, user.id]);
      const duplicate = candidates.rows.find(row => productIdentity(row.website_url) === identity);
      if (duplicate) {
        if (duplicate.allowed) return { ...duplicate, replayed: true };
        throw new Error(`DUPLICATE:${duplicate.status === "published" ? duplicate.slug : ""}`);
      }
      const accountAllowed = await consumeRateLimit(client, { action: "submission-account", keyHash: eventHash("submission:user", user.id), limit: 5, windowSeconds: 86400 });
      if (!accountAllowed) throw new Error("RATE_LIMITED");
      const allowed = await consumeRateLimit(client, { action: "submission", keyHash: networkHash(request, "submission"), limit: 5, windowSeconds: 3600 });
      if (!allowed) throw new Error("RATE_LIMITED");
      const slug = await uniqueSlug(client, validated.value.name);
      const metadata = submittedMetadata;
      const emailPreferenceId = await ensureFounderPreference(client, validated.value.contactEmail, form.get("marketingOptIn") === "on");
      const product = await client.query<{ id: string }>(
        // The founder types their product's name under a label that asks for the name
        // only, so it is also stored as the short display name (when it fits the display
        // limit). The submitted name itself is never rewritten afterwards.
        `INSERT INTO products
           (slug, website_url, submitted_url, normalized_domain, name, tagline, founder_name,
            contact_email, founder_social_handle, launch_at, launch_date, status,
            submission_consent_at, submission_consent_version, email_preference_id, created_by_user_id,
            use_case, intended_audience,
            pricing_model, starting_price_minor, pricing_currency, pricing_basis, pricing_unit,
            pricing_per_seat,
            short_name, short_name_source, short_name_updated_at, short_name_updated_by,
            pricing_source, pricing_confirmed_at, pricing_confirmed_by, category_provenance, published_at, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),$13,$14::uuid,$15,$16,$17,
            $18,$19,$20,$21,$22,$23,
            $24, CASE WHEN $24::text IS NULL THEN NULL ELSE 'founder' END,
            CASE WHEN $24::text IS NULL THEN NULL ELSE now() END,
            CASE WHEN $24::text IS NULL THEN NULL ELSE $15 END,
            CASE WHEN $18::text IS NULL THEN NULL ELSE 'founder' END,
            CASE WHEN $18::text IS NULL THEN NULL ELSE now() END,
            CASE WHEN $18::text IS NULL THEN NULL ELSE $15 END,
            'founder', CASE WHEN $12='published' THEN now() END, CASE WHEN $12='published' THEN now() END)
         RETURNING id::text`,
        [slug, validated.value.websiteUrl, validated.value.websiteUrl, validated.value.normalizedDomain,
         validated.value.name, validated.value.tagline, validated.value.founderName,
         validated.value.contactEmail, validated.value.founderSocialHandle, validated.value.launchAt,
         validated.value.launchDate, requestedStatus, validated.value.consentVersion, emailPreferenceId, user.id,
         validated.value.useCase, validated.value.intendedAudience,
         validated.value.pricing.model, validated.value.pricing.startingPriceMinor, validated.value.pricing.currency,
         validated.value.pricing.basis, validated.value.pricing.unit, validated.value.pricing.perSeat,
         validated.value.name.length <= 60 ? validated.value.name : null],
      );
      const productId = product.rows[0].id;
      await client.query(`UPDATE products SET submission_key=$2::uuid,submission_pro_selected=$3 WHERE id=$1::uuid`, [productId, submissionKey || null, form.get("proSelected") === "on"]);
      if (validated.value.categorySlugs.length) await applyProductCategories(client, productId, validated.value.categorySlugs, "founder");
      await client.query(`INSERT INTO product_owner_credentials (product_id, token_hash) VALUES ($1::uuid,$2)`, [productId, ownerHash]);
      await client.query(`INSERT INTO product_owners(product_id,user_id,verified_at,verification_method) VALUES($1::uuid,$2,now(),'new_submission')`, [productId,user.id]);
      await client.query(`UPDATE products SET launch_choice=$2,requested_launch_at=$3,published_at=CASE WHEN status='published' THEN now() END,approved_at=CASE WHEN status='published' THEN now() END WHERE id=$1::uuid`, [productId, ['now','scheduled','none'].includes(String(form.get('launchChoice'))) ? form.get('launchChoice') : 'now', form.get('launchChoice') === 'scheduled' && form.get('launchStartsAt') ? form.get('launchStartsAt') : null]);
      if (requestedStatus === "published") {
        await saveLaunch(client, productId, user.id, form.get("launchChoice"), form.get("launchStartsAt"));
        await insertFunnelEvent(client, { name: "publication_completed", idempotencyKey: productId, eventData: { productId } });
      }
      await client.query(`INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id) VALUES($1,'user','submission.management_associated',$2::uuid)`, [user.id,productId]);
      await client.query(
        `INSERT INTO product_submission_metadata
           (product_id, original_url, final_url, fetch_status, extracted_name, extracted_tagline,
            extracted_logo_url, extracted_image_url, fetched_at)
         VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [productId, metadata?.originalUrl ?? validated.value.websiteUrl,
         metadata?.finalUrl ?? validated.value.websiteUrl, metadata?.status ?? "manual",
         metadata?.productName ?? null, metadata?.tagline || null, metadata?.logoUrl ?? null,
         metadata?.screenshotUrl ?? null, metadata?.fetchedAt ? new Date(metadata.fetchedAt) : null],
      );
      for (const image of stored) {
        await client.query(
          `INSERT INTO product_media
             (product_id, kind, storage_key, public_url, mime_type, byte_size, width, height, position, alt_text)
           VALUES ($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [productId, image.kind, image.storageKey, image.publicUrl, image.mimeType, image.byteSize, image.width, image.height, image.position, image.altText ?? null],
        );
      }
      return { id: productId, slug, status: requestedStatus, replayed: false };
    });
    if (created.replayed) await Promise.all(stored.map((image) => removeStoredImage(image.storageKey)));
    const localManagementUrl = `${config.siteUrl}/manage/${created.slug}${created.status === "draft" ? "" : "/launch"}`;
    const response = NextResponse.json({
      product: { slug: created.slug, status: created.status },
      managementUrl: localManagementUrl,
      publicUrl: created.status === "published" ? `${config.siteUrl}/product/${created.slug}` : null,
      message: requestedStatus === "draft" ? "Draft saved." : "Your startup is published.",
    }, { status: 201, headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } });
    revalidatePath("/");
    revalidatePath(`/product/${created.slug}`);
    return response;
  } catch (error) {
    await Promise.all(stored.map((image) => removeStoredImage(image.storageKey)));
    const code = error instanceof Error ? error.message : "";
    if (code.startsWith("DUPLICATE:")) return NextResponse.json({ error: "This startup already has a listing. Continue through its management access page.", accessUrl: code.slice(10) ? `/activate/${code.slice(10)}` : null }, { status: 409 });
    if (code === "Choose a future date and time within six months.") return NextResponse.json({ error: code }, { status: 400 });
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "This startup already exists. Open My products to continue, or use Manage this startup on its public page." }, { status: 409 });
    if (code === "RATE_LIMITED") return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
    if (error instanceof InvalidCategorySelection) return NextResponse.json({ error: error.message, field: "categories" }, { status: 400 });
    // The founder only ever sees the generic message below, so the log has to carry
    // everything the database said about the failure. Row values are left out: they
    // repeat the founder's email back into the log.
    const failure = error as { code?: string; constraint?: string; table?: string };
    console.error("product submission failed", JSON.stringify({
      message: "submission transaction failed",
      code: failure?.code ?? null,
      constraint: failure?.constraint ?? null,
      table: failure?.table ?? null,
    }));
    return NextResponse.json({ error: "Could not save the submission." }, { status: 500 });
  }
}
