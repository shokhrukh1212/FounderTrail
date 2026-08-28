import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/db";
import { authenticateOwner } from "@/lib/owner-auth";
import { hashIntegrationSecret, newIntegrationSecret, newVerificationToken } from "@/lib/integration-security";
import { requestOriginIsSameSite } from "@/lib/request-security";

type Action = "create" | "create_secret" | "rotate";

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/integration">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Owner access required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { action?: unknown };
  const action: Action = body.action === "rotate" ? "rotate" : body.action === "create_secret" ? "create_secret" : "create";
  const secret = action === "create" ? null : newIntegrationSecret();

  try {
    const result = await withTransaction(async (client) => {
      const products = await client.query<{ normalized_domain: string; status: string }>(
        `SELECT normalized_domain,status FROM products WHERE id=$1::uuid`, [owner.productId]);
      const product = products.rows[0];
      if (!product) throw new Error("NOT_FOUND");
      if (product.status !== "published") throw new Error("NOT_APPROVED");
      const existing = await client.query<{ public_id: string; secret_hash: string | null }>(
        `SELECT public_id::text,secret_hash FROM product_integrations WHERE product_id=$1::uuid FOR UPDATE`, [owner.productId]);
      const integration = existing.rows[0];

      if (!integration) {
        if (action !== "create") throw new Error("NO_INTEGRATION");
        const inserted = await client.query<{ public_id: string }>(
          `INSERT INTO product_integrations (product_id,allowed_domain,secret_hash,verification_token)
           VALUES ($1::uuid,$2,NULL,$3) RETURNING public_id::text`, [owner.productId, product.normalized_domain, newVerificationToken()]);
        return { publicId: inserted.rows[0].public_id, secret: null, hasSecret: false, created: true };
      }
      if (action === "create") return { publicId: integration.public_id, secret: null, hasSecret: integration.secret_hash !== null, created: false };
      if (action === "create_secret" && integration.secret_hash) throw new Error("SECRET_EXISTS");
      await client.query(
        `UPDATE product_integrations
            SET secret_hash=$2,secret_version=CASE WHEN secret_hash IS NULL THEN secret_version ELSE secret_version+1 END,
                secret_created_at=COALESCE(secret_created_at,now()),secret_rotated_at=CASE WHEN secret_hash IS NULL THEN secret_rotated_at ELSE now() END,updated_at=now()
          WHERE product_id=$1::uuid`, [owner.productId, hashIntegrationSecret(secret!)]);
      return { publicId: integration.public_id, secret, hasSecret: true, created: false };
    });
    const message = result.secret
      ? "Copy this server secret now. It will not be shown again."
      : result.created ? "Verification setup created." : "Integration already exists.";
    return NextResponse.json({ ...result, message }, { status: result.created || result.secret ? 201 : 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_APPROVED") return NextResponse.json({ error: "Integration setup becomes available after approval." }, { status: 409 });
    if (code === "NO_INTEGRATION") return NextResponse.json({ error: "Create verification setup first." }, { status: 409 });
    if (code === "SECRET_EXISTS") return NextResponse.json({ error: "A server secret already exists. Rotate it instead." }, { status: 409 });
    console.error("integration setup failed", code || "unknown");
    return NextResponse.json({ error: "Could not configure the integration." }, { status: 500 });
  }
}
