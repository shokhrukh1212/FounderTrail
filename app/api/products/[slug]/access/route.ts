import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { currentUserFromHeaders } from "@/lib/auth";
import { config } from "@/lib/config";
import { withTransaction } from "@/lib/db";
import { associateOriginalSubmitter, grantManagement } from "@/lib/management-access";
import { consumeRateLimit } from "@/lib/rate-limit";
import { eventHash, requestOriginIsSameSite } from "@/lib/request-security";
import { formatEmailFrom } from "@/lib/email-sender";
export async function POST(request:Request,context:RouteContext<"/api/products/[slug]/access">){
  if(!requestOriginIsSameSite(request))return NextResponse.json({error:"Invalid origin."},{status:403});
  const user=await currentUserFromHeaders(request.headers);if(!user)return NextResponse.json({error:"Sign in required."},{status:401});
  const {slug}=await context.params;const body=await request.json().catch(()=>null);
  const rawToken=randomBytes(32).toString('base64url');
  try{
    const result=await withTransaction(async client=>{
      if(!await consumeRateLimit(client,{action:'management-access',keyHash:eventHash('access:user',user.id),limit:5,windowSeconds:3600}))throw new Error('Too many attempts. Try again in an hour.');
      const rows=await client.query<{id:string;legacy_contact_email:string|null}>(`SELECT id::text,legacy_contact_email FROM products WHERE slug=$1 AND (status='published' OR created_by_user_id=$2) FOR UPDATE`,[slug,user.id]);
      const product=rows.rows[0];if(!product)throw new Error('Use domain proof or support to recover this listing.');
      const owners=await client.query<{user_id:string}>(`SELECT user_id FROM product_owners WHERE product_id=$1::uuid`,[product.id]);
      if(owners.rows.some(row=>row.user_id===user.id))return {owned:true};
      if(owners.rowCount)throw new Error('This startup has another owner. Request access or a transfer using support.');
      if(await associateOriginalSubmitter(client,product.id,user.id))return {owned:true};
      const disputes=await client.query(`SELECT 1 FROM product_claims WHERE product_id=$1::uuid AND state='disputed'`,[product.id]);
      if(disputes.rowCount)throw new Error('An access dispute needs support review.');
      if(typeof body?.token==='string'){
        const tokenHash=createHash('sha256').update(body.token).digest('hex');
        const consumed=await client.query(`UPDATE product_access_tokens SET consumed_at=now() WHERE token_hash=$1 AND product_id=$2::uuid AND claimant_id=$3 AND consumed_at IS NULL AND expires_at>now() RETURNING token_hash`,[tokenHash,product.id,user.id]);
        if(!consumed.rowCount)throw new Error('This link expired, was already used, or belongs to a different signed-in account. Request a new link.');
        await grantManagement(client,product.id,user.id,'verified_email');return {owned:true};
      }
      const authority=await client.query(`SELECT 1 FROM app_users WHERE id=$1 AND google_authority_email=$2 AND google_authority_at::timestamptz>now()-interval '1 hour'`,[user.id,product.legacy_contact_email]);
      if(product.legacy_contact_email && authority.rowCount){await grantManagement(client,product.id,user.id,'verified_email');return {owned:true};}
      if(!product.legacy_contact_email)throw new Error('No original contact is available. Use domain proof or support below.');
      if(!config.email.resendApiKey || !config.email.from)throw new Error('Email recovery is unavailable. Use domain proof or support below.');
      if(!await consumeRateLimit(client,{action:'management-access-listing',keyHash:eventHash('access:listing',product.id),limit:3,windowSeconds:3600}))throw new Error('A recovery email was requested recently. Please wait before trying again.');
      await client.query(`INSERT INTO product_access_tokens(token_hash,product_id,claimant_id,expires_at) VALUES($1,$2::uuid,$3,now()+interval '30 minutes')`,[createHash('sha256').update(rawToken).digest('hex'),product.id,user.id]);
      return {owned:false,email:product.legacy_contact_email};
    });
    if(result.owned)return NextResponse.json({workspace:`/manage/${slug}/launch`});
    const link=`${config.siteUrl}/activate/${encodeURIComponent(slug)}#access=${encodeURIComponent(rawToken)}`;
    const sent=await new Resend(config.email.resendApiKey).emails.send({from:formatEmailFrom(config.email.from),to:result.email!,subject:'Confirm your FounderTrail management access',text:`Someone signed in to FounderTrail requested access to your existing listing. If this was you, open the link and select Confirm access while signed in with the same account. The link expires in 30 minutes.\n\n${link}\n\nIf you did not request this, ignore this email.`});
    if(sent.error)return NextResponse.json({error:'Could not deliver recovery email. Try again or use domain proof.'},{status:502});
    return NextResponse.json({message:'Check the original listing contact’s inbox for a one-time verification link. The private address is not displayed here.'});
  }catch(error){const message=error instanceof Error?error.message:'';return NextResponse.json({error:/^(Too many|Use domain|This startup|An access|This link|No original|Email recovery|A recovery)/.test(message)?message:'Could not complete access recovery. Try again or contact support.'},{status:409});}
}
