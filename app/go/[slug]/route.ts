import { NextResponse } from "next/server";
import { BIDINDEX_VISITOR_COOKIE, bidIndexVisitorCookieOptions } from "@/lib/bidindex-visitor";
import { config } from "@/lib/config";
import { recordProductClick } from "@/lib/product-click";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/go/[slug]">) {
  const { slug } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return NextResponse.redirect(new URL("/", config.siteUrl));
  try {
    const result = await recordProductClick(request, slug);
    const response = NextResponse.redirect(result.destination ?? new URL("/", config.siteUrl), { status: 302 });
    if (result.visitor.isNew) response.cookies.set(BIDINDEX_VISITOR_COOKIE, result.visitor.id, bidIndexVisitorCookieOptions);
    return response;
  } catch (error) {
    console.error("product click tracking failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.redirect(new URL("/", config.siteUrl), { status: 302 });
  }
}
