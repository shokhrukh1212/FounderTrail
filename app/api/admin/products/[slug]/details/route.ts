import { NextResponse } from "next/server";
import { validAdminRequest } from "@/lib/admin-auth";
import { getAdminProductDetail } from "@/lib/admin-products";
import { currentUserFromHeaders } from "@/lib/auth";
import { normalizeCategorySelection } from "@/lib/categories";
import { withTransaction } from "@/lib/db";
import { applyProductCategories, InvalidCategorySelection } from "@/lib/product-categories";
import { parsePricingInput } from "@/lib/product-pricing";
import { requestOriginIsSameSite } from "@/lib/request-security";

export const dynamic="force-dynamic";
export async function GET(request:Request,context:RouteContext<"/api/admin/products/[slug]/details">){
  if(!(await validAdminRequest(request)))return NextResponse.json({error:"Admin access required."},{status:401,headers:{"cache-control":"no-store"}});
  const {slug}=await context.params;const product=await getAdminProductDetail(slug);
  return product?NextResponse.json({product},{headers:{"cache-control":"no-store"}}):NextResponse.json({error:"Product not found."},{status:404,headers:{"cache-control":"no-store"}});
}

/**
 * Admin correction of the three things a person owns: the short display name, the 1-3
 * categories, and the startup's own pricing. The submitted name, slug, ownership, votes,
 * follows, comments and click history are not touched here.
 */
export async function PATCH(request:Request,context:RouteContext<"/api/admin/products/[slug]/details">){
  if(!requestOriginIsSameSite(request))return NextResponse.json({error:"Invalid origin."},{status:403});
  if(!(await validAdminRequest(request)))return NextResponse.json({error:"Admin access required."},{status:401,headers:{"cache-control":"no-store"}});
  const {slug}=await context.params;
  const actor=await currentUserFromHeaders(request.headers).catch(()=>null);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body)return NextResponse.json({error:"Invalid request body."},{status:400});

  const rawShortName=typeof body.shortName==="string"?body.shortName.trim():"";
  if(rawShortName.length>60)return NextResponse.json({error:"Use 60 characters or fewer for the short name.",field:"shortName"},{status:400});
  // An empty short name clears the correction and falls back to the submitted name.
  const shortName=rawShortName||null;

  const categories=normalizeCategorySelection(body.categories);
  if(!categories.ok)return NextResponse.json({error:categories.error,field:"categories"},{status:400});

  const pricing=parsePricingInput(body);
  if(!pricing.ok)return NextResponse.json({error:pricing.error,field:pricing.field},{status:400});
  const openSource=body.isOpenSource===true||body.isOpenSource==="on";

  try{
    const updated=await withTransaction(async(client)=>{
      const rows=await client.query<{id:string}>(`SELECT id::text FROM products WHERE slug=$1 FOR UPDATE`,[slug]);
      const productId=rows.rows[0]?.id;
      if(!productId)return null;
      await client.query(
        `UPDATE products
            SET short_name=$2,
                short_name_source=CASE WHEN $2::text IS NULL THEN NULL ELSE 'admin' END,
                short_name_updated_at=CASE WHEN $2::text IS NULL THEN NULL ELSE now() END,
                short_name_updated_by=CASE WHEN $2::text IS NULL THEN NULL ELSE $3 END,
                pricing_model=$4,starting_price_minor=$5,pricing_currency=$6,pricing_basis=$7,pricing_unit=$8,
                pricing_per_seat=$9,is_open_source=$10,
                pricing_source=CASE WHEN $4::text IS NULL THEN NULL ELSE 'admin' END,
                pricing_confirmed_at=CASE WHEN $4::text IS NULL THEN NULL ELSE now() END,
                pricing_confirmed_by=CASE WHEN $4::text IS NULL THEN NULL ELSE $3 END,
                updated_at=now()
          WHERE id=$1::uuid`,
        [productId,shortName,actor?.id??null,pricing.value.model,pricing.value.startingPriceMinor,pricing.value.currency,
         pricing.value.basis,pricing.value.unit,pricing.value.perSeat,openSource],
      );
      await applyProductCategories(client,productId,categories.slugs,"admin");
      await client.query(
        `INSERT INTO foundertrail_audit_events(actor_user_id,actor_kind,action,product_id,details)
         VALUES($1,'admin','product.listing_corrected',$2::uuid,jsonb_build_object('shortName',$3::text,'categories',$4::text[],'pricingModel',$5::text,'openSource',$6::boolean))`,
        [actor?.id??null,productId,shortName,categories.slugs,pricing.value.model,openSource],
      );
      return productId;
    });
    if(!updated)return NextResponse.json({error:"Product not found."},{status:404});
  }catch(error){
    if(error instanceof InvalidCategorySelection)return NextResponse.json({error:error.message,field:"categories"},{status:400});
    throw error;
  }
  const product=await getAdminProductDetail(slug);
  return NextResponse.json({message:"Listing updated.",product},{headers:{"cache-control":"no-store"}});
}
