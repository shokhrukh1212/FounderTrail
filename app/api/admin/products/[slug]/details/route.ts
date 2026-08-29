import { NextResponse } from "next/server";
import { adminSessionFromRequest,validAdminSession } from "@/lib/admin-auth";
import { getAdminProductDetail } from "@/lib/admin-products";

export const dynamic="force-dynamic";
export async function GET(request:Request,context:RouteContext<"/api/admin/products/[slug]/details">){
  if(!validAdminSession(adminSessionFromRequest(request)))return NextResponse.json({error:"Admin access required."},{status:401,headers:{"cache-control":"no-store"}});
  const {slug}=await context.params;const product=await getAdminProductDetail(slug);
  return product?NextResponse.json({product},{headers:{"cache-control":"no-store"}}):NextResponse.json({error:"Product not found."},{status:404,headers:{"cache-control":"no-store"}});
}
