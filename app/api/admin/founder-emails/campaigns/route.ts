import { NextResponse } from "next/server";
import { validAdminRequest } from "@/lib/admin-auth";
import { config } from "@/lib/config";
import { createCampaign,listCampaigns,validateCampaignDraft } from "@/lib/founder-email-campaigns";
import { requestOriginIsSameSite } from "@/lib/request-security";
export const dynamic="force-dynamic";
export async function GET(request:Request){if(!await validAdminRequest(request))return NextResponse.json({error:"Admin access required."},{status:401});return NextResponse.json({campaigns:await listCampaigns()})}
export async function POST(request:Request){if(!requestOriginIsSameSite(request))return NextResponse.json({error:"Invalid origin."},{status:403});if(!await validAdminRequest(request))return NextResponse.json({error:"Admin access required."},{status:401});const parsed=validateCampaignDraft(await request.json().catch(()=>null));if(!parsed.draft)return NextResponse.json({error:parsed.error},{status:400});const id=await createCampaign(parsed.draft,config.adminAuditActor);return NextResponse.json({id},{status:201})}
