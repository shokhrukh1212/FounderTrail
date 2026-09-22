import { cookies,headers } from "next/headers";
import { notFound,redirect } from "next/navigation";
import { FounderEmailComposer } from "@/components/FounderEmailComposer";
import { CampaignOperations } from "@/components/CampaignOperations";
import { ADMIN_COOKIE,validAdminPageSession } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { CAMPAIGN_TEMPLATES } from "@/lib/email-templates";
import { getCampaign,rowToDraft,templateDraft } from "@/lib/founder-email-campaigns";
export const dynamic="force-dynamic";
export default async function EditFounderEmailPage({params}:PageProps<"/admin/founder-emails/[campaignId]">){if(!await validAdminPageSession(await headers(),(await cookies()).get(ADMIN_COOKIE)?.value??null))redirect("/admin");const {campaignId}=await params;const [campaign,products]=await Promise.all([getCampaign(campaignId),query<{id:string;name:string;founder_name:string|null;status:string}>(`SELECT id::text,name,founder_name,status FROM products WHERE NOT is_demo ORDER BY name`)]);if(!campaign)notFound();const templates=Object.values(CAMPAIGN_TEMPLATES).map(item=>({key:item.key,label:item.label,draft:templateDraft(item.key)}));return <main className="app-shell inner-page"><header className="page-heading"><p className="eyebrow">Founder emails</p><h1>{campaign.internal_name}</h1><p>Status: {campaign.status} · {campaign.recipient_count} recipients</p><CampaignOperations id={campaign.id} status={campaign.status}/></header>{campaign.status==="draft"?<FounderEmailComposer campaignId={campaign.id} initial={rowToDraft(campaign)} templates={templates} products={products.map(p=>({id:p.id,name:p.name,founderName:p.founder_name,status:p.status}))}/>:<section className="manager-card"><h2>Delivery summary</h2><p>This campaign is {campaign.status}. Its frozen recipient snapshot is being processed in batches and this page refreshes while delivery is active.</p></section>}</main>}
