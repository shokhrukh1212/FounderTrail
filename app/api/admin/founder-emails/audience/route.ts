import { NextResponse } from "next/server";

import { validAdminRequest } from "@/lib/admin-auth";
import { CAMPAIGN_TEMPLATE_KEYS,type CampaignTemplateKey } from "@/lib/email-templates";
import { previewAudience,type CampaignAudience } from "@/lib/founder-email-campaigns";
import { requestOriginIsSameSite } from "@/lib/request-security";
export async function POST(request:Request){if(!requestOriginIsSameSite(request))return NextResponse.json({error:"Invalid origin."},{status:403});if(!await validAdminRequest(request))return NextResponse.json({error:"Admin access required."},{status:401});const body=await request.json().catch(()=>null) as {audience?:CampaignAudience;messageClass?:unknown;productSpecific?:unknown;templateKey?:unknown}|null;const templateKey=CAMPAIGN_TEMPLATE_KEYS.includes(body?.templateKey as CampaignTemplateKey)?body?.templateKey as CampaignTemplateKey:undefined;if(!body?.audience||!["marketing","transactional"].includes(String(body.messageClass)))return NextResponse.json({error:"Invalid audience."},{status:400});return NextResponse.json(await previewAudience(body.audience,body.messageClass as "marketing"|"transactional",body.productSpecific===true,templateKey))}
