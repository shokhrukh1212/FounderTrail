import { NextResponse } from "next/server";
import { adminSessionFromRequest,validAdminSession } from "@/lib/admin-auth";
import { renderCampaignPreview,validateCampaignDraft } from "@/lib/founder-email-campaigns";
import { requestOriginIsSameSite } from "@/lib/request-security";
export async function POST(request:Request){if(!requestOriginIsSameSite(request))return NextResponse.json({error:"Invalid origin."},{status:403});if(!validAdminSession(adminSessionFromRequest(request)))return NextResponse.json({error:"Admin access required."},{status:401});const body=await request.json().catch(()=>null) as {draft?:unknown;mode?:unknown}|null;const parsed=validateCampaignDraft(body?.draft);if(!parsed.draft)return NextResponse.json({error:parsed.error},{status:400});return NextResponse.json(renderCampaignPreview(parsed.draft,body?.mode==="mobile"?"mobile":"desktop"))}
