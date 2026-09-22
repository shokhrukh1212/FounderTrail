import { NextResponse } from "next/server";

import { validAdminRequest } from "@/lib/admin-auth";
import { hashBidIndexOwnerToken, newBidIndexOwnerToken } from "@/lib/bidindex-owner";
import { config } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/admin/products/[slug]/owner-link">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  if (!(await validAdminRequest(request))) return NextResponse.json({ error: "Admin access required." }, { status: 401 });
  const { slug } = await context.params;
  const token = newBidIndexOwnerToken();
  const tokenHash = hashBidIndexOwnerToken(token);
  const product = await withTransaction(async (client) => {
    const rows = await client.query<{ id: string; status: string }>(
      `SELECT id::text,status FROM products WHERE slug=$1 AND status IN ('pending','published') FOR UPDATE`,
      [slug],
    );
    const item = rows.rows[0];
    if (!item) return null;
    await client.query(
      `UPDATE product_owner_credentials
          SET token_hash=$2,token_version=token_version+1,rotated_at=now()
        WHERE product_id=$1::uuid`,
      [item.id, tokenHash],
    );
    await client.query(
      `INSERT INTO product_moderation_events (product_id,from_status,to_status,internal_reason)
       VALUES ($1::uuid,$2,$2,'Owner management link rotated by administrator')`,
      [item.id, item.status],
    );
    return item;
  });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  return NextResponse.json(
    { managementUrl: `${config.siteUrl}/manage/${slug}#token=${token}` },
    { headers: { "cache-control": "no-store", "referrer-policy": "no-referrer" } },
  );
}
