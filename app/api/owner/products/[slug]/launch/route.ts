import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authenticateOwner } from "@/lib/owner-auth";
import { withTransaction } from "@/lib/db";
import { saveLaunch } from "@/lib/launch-service";
import { requestOriginIsSameSite } from "@/lib/request-security";

export async function POST(request: Request, context: RouteContext<"/api/owner/products/[slug]/launch">) {
  if (!requestOriginIsSameSite(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const { slug } = await context.params;
  const owner = await authenticateOwner(request, slug);
  if (!owner) return NextResponse.json({ error: "Management access required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !['now','scheduled','none'].includes(body.choice)) return NextResponse.json({ error: "Choose a launch option." }, { status: 400 });
  try {
    const launch = await withTransaction(async client => {
      const product = await client.query(`SELECT id FROM products WHERE id=$1::uuid AND status='published' FOR UPDATE`, [owner.productId]);
      if (!product.rowCount) throw new Error("Publish your page before launching.");
      return saveLaunch(client, owner.productId, owner.userId, body.choice, body.startsAt, body.reschedule === true);
    });
    revalidatePath("/"); revalidatePath(`/product/${slug}`); revalidatePath(`/manage/${slug}/launch`);
    return NextResponse.json({ launch });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const expected = ["Choose a launch option.","Choose a future date and time within six months.","A launch that has started cannot be changed or repeated.","Publish your page before launching."];
    return NextResponse.json({ error: expected.includes(message) ? message : "Could not save your launch. Please retry." }, { status: expected.includes(message) ? 400 : 500 });
  }
}
