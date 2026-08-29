import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminGrowthSettings } from "@/components/AdminGrowthSettings";
import { ADMIN_COOKIE,validAdminSession } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { listCampaigns } from "@/lib/founder-email-campaigns";
export const dynamic="force-dynamic";
type History={id:string;internal_name:string;template_key:string;message_class:string;status:string;recipient_count:number;sent_count:number;failed_count:number;scheduled_at:Date|null;sent_at:Date|null;created_at:Date};
export default async function FounderEmailsPage(){
  if(!validAdminSession((await cookies()).get(ADMIN_COOKIE)?.value??null))redirect("/admin");
  const [campaigns,notifications,milestones,site]=await Promise.all([
    listCampaigns() as Promise<History[]>,
    query<{id:string;title:string;body:string;created_at:Date}>(`SELECT id::text,title,body,created_at FROM admin_notifications WHERE read_at IS NULL ORDER BY created_at DESC LIMIT 10`),
    query<{threshold:number;enabled:boolean;automatic_sending:boolean}>(`SELECT threshold,enabled,automatic_sending FROM visitor_milestone_settings ORDER BY threshold`),
    query<{founding_banner_enabled:boolean;founding_banner_ends_at:Date|null}>(`SELECT founding_banner_enabled,founding_banner_ends_at FROM site_config WHERE singleton=true`),
  ]);
  return <main className="app-shell inner-page founder-email-admin"><header className="page-heading"><p className="eyebrow">Admin only</p><h1>Founder emails</h1><p>Product/owner updates and opt-in marketing/growth campaigns, with deduplication, suppression, and durable delivery.</p><div className="campaign-actions"><Link className="button" href="/admin">Product moderation</Link><Link className="button button-primary" href="/admin/founder-emails/new">Create campaign</Link></div></header>{notifications.length?<section className="manager-card"><h2>Notifications</h2>{notifications.map(item=><article className="campaign-history-row" key={item.id}><div><strong>{item.title}</strong><p>{item.body}</p></div><time>{item.created_at.toLocaleString()}</time></article>)}</section>:null}<AdminGrowthSettings bannerEnabled={site[0]?.founding_banner_enabled??false} bannerEndsAt={site[0]?.founding_banner_ends_at?.toISOString()??null} initialMilestones={milestones.map(item=>({threshold:item.threshold,enabled:item.enabled,automaticSending:item.automatic_sending}))}/><section className="campaign-history"><div className="admin-section-heading"><div><h2>Campaign history</h2><p>Progress and delivery summaries contain provider IDs only—never management links or tokens.</p></div></div>{campaigns.length?campaigns.map(item=><Link className="campaign-history-row" href={`/admin/founder-emails/${item.id}`} key={item.id}><div><strong>{item.internal_name}</strong><p>{item.template_key.replaceAll("_"," ")} · {item.message_class==="marketing"?"Marketing/growth":"Product/owner update"}</p></div><div><span className={`campaign-status is-${item.status}`}>{item.status}</span><small>{item.sent_count}/{item.recipient_count} sent{item.failed_count?` · ${item.failed_count} failed`:""}</small></div></Link>):<p className="compact-empty">No campaigns yet.</p>}</section></main>
}
