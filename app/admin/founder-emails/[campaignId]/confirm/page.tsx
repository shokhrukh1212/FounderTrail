import { cookies,headers } from "next/headers";
import { notFound,redirect } from "next/navigation";
import { CampaignConfirmation } from "@/components/CampaignConfirmation";
import { ADMIN_COOKIE,validAdminPageSession } from "@/lib/admin-auth";
import { getCampaign,previewAudience } from "@/lib/founder-email-campaigns";
export const dynamic="force-dynamic";
export default async function ConfirmCampaignPage({params}:PageProps<"/admin/founder-emails/[campaignId]/confirm">){if(!await validAdminPageSession(await headers(),(await cookies()).get(ADMIN_COOKIE)?.value??null))redirect("/admin");const {campaignId}=await params;const campaign=await getCampaign(campaignId);if(!campaign||campaign.status!=="draft")notFound();const audience=await previewAudience(campaign.audience,campaign.message_class,campaign.product_specific,campaign.template_key);return <main className="app-shell inner-page"><header className="page-heading"><p className="eyebrow">Final review</p><h1>{campaign.internal_name}</h1><p>{campaign.subject}</p></header><CampaignConfirmation id={campaign.id} audience={audience} messageClass={campaign.message_class} scheduledAt={campaign.scheduled_at?.toISOString()??null}/></main>}
