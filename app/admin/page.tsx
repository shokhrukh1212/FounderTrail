import { cookies } from "next/headers";
import { AdminLogin } from "@/components/AdminLogin";
import { ModerationList } from "@/components/ModerationList";
import { ADMIN_COOKIE,validAdminSession } from "@/lib/admin-auth";
import { query } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function AdminPage(){const session=(await cookies()).get(ADMIN_COOKIE)?.value??null;if(!validAdminSession(session))return <main className="app-shell inner-page"><AdminLogin/></main>;const rows=await query<{id:string;slug:string;name:string;tagline:string;website_url:string;founder_name:string;submitted_at:Date}>(`SELECT id::text,slug,name,tagline,website_url,founder_name,submitted_at FROM products WHERE status='pending' ORDER BY submitted_at`);return <main className="app-shell inner-page"><header className="page-heading"><p className="eyebrow">Owner-only</p><h1>Product moderation</h1><p>Review pending launches. Publishing does not change votes, metrics, or payment state.</p></header><ModerationList items={rows.map(row=>({id:row.id,slug:row.slug,name:row.name,tagline:row.tagline,websiteUrl:row.website_url,founderName:row.founder_name,submittedAt:row.submitted_at.toISOString()}))}/></main>}
