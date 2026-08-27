import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { IntegrationManager } from "@/components/IntegrationManager";
import { ownerCookieName, tokenHashMatches } from "@/lib/bidindex-owner";
import { query } from "@/lib/db";
import { getManagedProduct } from "@/lib/product-data";
import { config } from "@/lib/config";

export const dynamic="force-dynamic";
export default async function IntegrationPage({params}:PageProps<"/manage/[slug]/integration">){const {slug}=await params;const product=await getManagedProduct(slug);if(!product)notFound();const token=(await cookies()).get(ownerCookieName(product.id))?.value??null;if(!tokenHashMatches(product.ownerTokenHash,token))return <main className="app-shell inner-page"><p>Open your private product management link first.</p></main>;const rows=await query<{public_id:string;allowed_domain:string;verification_token:string;domain_status:string;last_event_at:Date|null}>(`SELECT public_id::text,allowed_domain,verification_token,domain_status,last_event_at FROM product_integrations WHERE product_id=$1::uuid`,[product.id]);const row=rows[0];return <main className="app-shell inner-page manage-page"><a className="text-link" href={`/manage/${slug}`}>← Back to product management</a><IntegrationManager slug={slug} siteUrl={config.siteUrl} initial={row?{publicId:row.public_id,allowedDomain:row.allowed_domain,verificationToken:row.verification_token,domainStatus:row.domain_status,lastEventAt:row.last_event_at?.toISOString()??null}:null}/></main>}
