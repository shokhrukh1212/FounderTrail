import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { FounderEmailComposer } from "@/components/FounderEmailComposer";
import { ADMIN_COOKIE,validAdminPageSession } from "@/lib/admin-auth";
import { query } from "@/lib/db";
import { CAMPAIGN_TEMPLATES } from "@/lib/email-templates";
import { FOUNDERTRAIL_LAUNCH_MIGRATION,templateDraft } from "@/lib/founder-email-campaigns";

export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function NewFounderEmailPage({searchParams}:{searchParams:Promise<{productIds?:string;selectAll?:string;template?:string}>}){
  if(!await validAdminPageSession(await headers(),(await cookies()).get(ADMIN_COOKIE)?.value??null))redirect("/admin");
  const params=await searchParams;
  const products=await query<{id:string;name:string;founder_name:string|null;status:"draft"|"pending"|"published"|"rejected"|"archived"}>(`SELECT id::text,name,founder_name,status FROM products WHERE NOT is_demo ORDER BY name`);
  const launch=await query<{applied_at:Date}>(`SELECT applied_at FROM schema_migrations WHERE name=$1`,[FOUNDERTRAIL_LAUNCH_MIGRATION]);
  const selected=(params.productIds??"").split(",").filter(id=>UUID.test(id));
  const selectedStatuses=[...new Set(products.filter(product=>selected.includes(product.id)).map(product=>product.status))];
  const template=typeof params.template==="string"&&params.template in CAMPAIGN_TEMPLATES?params.template as keyof typeof CAMPAIGN_TEMPLATES:"visitor_milestone";
  const initial=templateDraft(template);
  initial.audience=params.selectAll==="true"?{...initial.audience,selectAll:true,productIds:[]}:{...initial.audience,selectAll:false,productIds:selected,statuses:selectedStatuses.length?selectedStatuses:["published"]};
  const templates=Object.values(CAMPAIGN_TEMPLATES).map(item=>({key:item.key,label:item.label,draft:templateDraft(item.key)}));
  return <main className="app-shell inner-page"><header className="page-heading"><p className="eyebrow">Founder emails</p><h1>Create campaign</h1></header><FounderEmailComposer initial={initial} templates={templates} foundertrailLaunchAt={launch[0]?.applied_at.toISOString()??null} products={products.map(product=>({id:product.id,name:product.name,founderName:product.founder_name,status:product.status}))}/></main>;
}
