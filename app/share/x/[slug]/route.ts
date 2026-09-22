import { NextResponse } from "next/server";
import { isObviousBot } from "@/lib/click";
import { BIDINDEX_VISITOR_COOKIE,bidIndexVisitorCookieOptions,ensureBidIndexVisitor } from "@/lib/bidindex-visitor";
import { config } from "@/lib/config";
import { query } from "@/lib/db";
import { displayProductName } from "@/lib/display-text";
import { xLaunchIntent, xProductShareIntent } from "@/lib/product-share";
import { networkHash } from "@/lib/request-security";

const SOURCES=new Set(["owner","product","email","admin","unknown"]);
export async function GET(request:Request,context:RouteContext<"/share/x/[slug]">){
  const {slug}=await context.params;const sourceRaw=new URL(request.url).searchParams.get("source")??"unknown";const source=SOURCES.has(sourceRaw)?sourceRaw:"unknown";const visitor=ensureBidIndexVisitor(request);
  const rows=await query<{id:string;name:string;short_name:string|null;tagline:string}>(`SELECT p.id::text,p.name,p.short_name,p.tagline FROM products p WHERE p.slug=$1 AND p.status='published' AND ($2::boolean OR NOT p.is_demo) LIMIT 1`,[slug,process.env.NODE_ENV!=="production"]);
  const product=rows[0];if(!product)return NextResponse.redirect(new URL("/",config.siteUrl));
  if(!isObviousBot(request))await query(`INSERT INTO product_share_events (product_id,event_name,visitor_hash,network_hash,source) VALUES ($1::uuid,'share_intent_opened',$2,$3,$4)`,[product.id,visitor.hash,networkHash(request,"share-intent"),source]);
  // A visitor sharing a product page is not its founder. Only the founder's own surfaces
  // keep the first-person launch draft; everything else gets the neutral product draft.
  const intent=source==="owner"||source==="email"
    ?xLaunchIntent({siteUrl:config.siteUrl,slug,productName:product.name,description:product.tagline,bidIndexHandle:config.bidIndexXHandle})
    :xProductShareIntent({siteUrl:config.siteUrl,slug,shortProductName:displayProductName(product.name,product.short_name)});
  const response=NextResponse.redirect(intent,{status:302});
  if(visitor.isNew)response.cookies.set(BIDINDEX_VISITOR_COOKIE,visitor.id,bidIndexVisitorCookieOptions);return response;
}
