import { cookies } from "next/headers";
import { notFound,redirect } from "next/navigation";
import { CampaignConfirmation } from "@/components/CampaignConfirmation";
import { ADMIN_COOKIE,validAdminSession } from "@/lib/admin-auth";
import { getCampaign,previewAudience } from "@/lib/founder-email-campaigns";
export const dynamic="force-dynamic";
export default async function ConfirmCampaignPage({params}:PageProps<"/admin/founder-emails/[campaignId]/confirm">){if(!validAdminSession((await cookies()).get(ADMIN_COOKIE)?.value??null))redirect("/admin");const {campaignId}=await params;const campaign=await getCampaign(campaignId);if(!campaign||campaign.status!=="draft")notFound();const audience=await previewAudience(campaign.audience,campaign.message_class,campaign.product_specific);return <main className="app-shell inner-page"><header className="page-heading"><p className="eyebrow">Final review</p><h1>{campaign.internal_name}</h1><p>{campaign.subject}</p></header><CampaignConfirmation id={campaign.id} count={audience.count} scheduledAt={campaign.scheduled_at?.toISOString()??null}/></main>}
