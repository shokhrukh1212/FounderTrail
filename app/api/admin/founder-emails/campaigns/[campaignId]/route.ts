import { NextResponse } from "next/server";
import { adminSessionFromRequest,validAdminSession } from "@/lib/admin-auth";
import { config } from "@/lib/config";
import { getCampaign,rowToDraft,updateCampaign,validateCampaignDraft } from "@/lib/founder-email-campaigns";
import { requestOriginIsSameSite } from "@/lib/request-security";
function authorized(request:Request){return validAdminSession(adminSessionFromRequest(request))}
export async function GET(request:Request,context:RouteContext<"/api/admin/founder-emails/campaigns/[campaignId]">){if(!authorized(request))return NextResponse.json({error:"Admin access required."},{status:401});const {campaignId}=await context.params;const campaign=await getCampaign(campaignId);return campaign?NextResponse.json({campaign,draft:rowToDraft(campaign)}):NextResponse.json({error:"Campaign not found."},{status:404})}
export async function PATCH(request:Request,context:RouteContext<"/api/admin/founder-emails/campaigns/[campaignId]">){if(!requestOriginIsSameSite(request))return NextResponse.json({error:"Invalid origin."},{status:403});if(!authorized(request))return NextResponse.json({error:"Admin access required."},{status:401});const {campaignId}=await context.params;const parsed=validateCampaignDraft(await request.json().catch(()=>null));if(!parsed.draft)return NextResponse.json({error:parsed.error},{status:400});return await updateCampaign(campaignId,parsed.draft,config.adminAuditActor)?NextResponse.json({ok:true}):NextResponse.json({error:"Only draft campaigns can be edited."},{status:409})}
