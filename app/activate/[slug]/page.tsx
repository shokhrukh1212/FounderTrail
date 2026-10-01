import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";
import { ManagementAccess } from "@/components/ManagementAccess";
export const dynamic="force-dynamic";
export const metadata={title:"Manage your startup",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function ActivatePage({params}:PageProps<"/activate/[slug]">){
  const {slug}=await params;
  const destination=`/activate/${slug}`;
  const user=await currentUserFromHeaders(await headers());if(!user)redirect(`/sign-in?returnTo=${encodeURIComponent(destination)}`);
  const rows=await query<{name:string;has_contact:boolean;owned:boolean}>(`SELECT coalesce(p.short_name,p.name) AS name,(p.legacy_contact_email IS NOT NULL) AS has_contact,EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2) AS owned FROM products p WHERE p.slug=$1 AND (p.status='published' OR p.created_by_user_id=$2 OR EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2))`,[slug,user.id]);
  if(!rows[0])notFound();if(rows[0].owned)redirect(`/manage/${slug}/launch`);
  return <main className="app-shell inner-page account-page"><header className="page-heading"><p className="eyebrow">Founder access</p><h1>{rows[0].name}</h1><p>Continue with your existing page and all its history.</p></header><ManagementAccess slug={slug} hasContact={rows[0].has_contact}/></main>;
}
