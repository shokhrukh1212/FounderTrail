import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FounderEmailComposer } from "@/components/FounderEmailComposer";
import { ADMIN_COOKIE,validAdminSession } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { CAMPAIGN_TEMPLATES } from "@/lib/email-templates";
import { templateDraft } from "@/lib/founder-email-campaigns";
export const dynamic="force-dynamic";
export default async function NewFounderEmailPage(){if(!validAdminSession((await cookies()).get(ADMIN_COOKIE)?.value??null))redirect("/admin");const products=await query<{id:string;name:string;founder_name:string;status:string}>(`SELECT id::text,name,founder_name,status FROM products WHERE status IN ('published','pending') AND NOT is_demo ORDER BY name`);const templates=Object.values(CAMPAIGN_TEMPLATES).map(item=>({key:item.key,label:item.label,draft:templateDraft(item.key)}));return <main className="app-shell inner-page"><header className="page-heading"><p className="eyebrow">Founder emails</p><h1>Create campaign</h1></header><FounderEmailComposer initial={templateDraft("founding_product")} templates={templates} products={products.map(p=>({id:p.id,name:p.name,founderName:p.founder_name,status:p.status}))}/></main>}
