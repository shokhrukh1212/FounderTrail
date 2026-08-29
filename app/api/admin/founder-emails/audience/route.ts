import { NextResponse } from "next/server";
import { adminSessionFromRequest,validAdminSession } from "@/lib/admin-auth";
import { previewAudience,type CampaignAudience } from "@/lib/founder-email-campaigns";
import { requestOriginIsSameSite } from "@/lib/request-security";
export async function POST(request:Request){if(!requestOriginIsSameSite(request))return NextResponse.json({error:"Invalid origin."},{status:403});if(!validAdminSession(adminSessionFromRequest(request)))return NextResponse.json({error:"Admin access required."},{status:401});const body=await request.json().catch(()=>null) as {audience?:CampaignAudience;messageClass?:unknown;productSpecific?:unknown}|null;if(!body?.audience||!["marketing","transactional"].includes(String(body.messageClass)))return NextResponse.json({error:"Invalid audience."},{status:400});return NextResponse.json(await previewAudience(body.audience,body.messageClass as "marketing"|"transactional",body.productSpecific===true))}
