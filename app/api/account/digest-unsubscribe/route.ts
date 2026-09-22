import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { readDigestUnsubscribeToken } from "@/lib/digest";
export async function POST(request:Request){const body=await request.json().catch(()=>null) as {token?:unknown}|null;const userId=typeof body?.token==="string"?readDigestUnsubscribeToken(body.token):null;if(!userId)return NextResponse.json({error:"Invalid token."},{status:400});const rows=await query(`UPDATE app_users SET digest_opted_in=false,digest_unsubscribed_at=coalesce(digest_unsubscribed_at,now()),updated_at=now() WHERE id=$1 RETURNING id`,[userId]);return rows[0]?NextResponse.json({ok:true}):NextResponse.json({error:"Invalid token."},{status:400})}
