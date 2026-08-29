import Link from "next/link";
import { cookies } from "next/headers";
import { AdminVisitorCount } from "@/components/AdminVisitorCount";
import { ADMIN_COOKIE,validAdminSession } from "@/lib/admin-auth";
import { config } from "@/lib/config";
import { getAdminVisitorStat } from "@/lib/visitors";
export default async function AdminLayout({children}:{children:React.ReactNode}){
  const authenticated=validAdminSession((await cookies()).get(ADMIN_COOKIE)?.value??null);
  // A database hiccup must not take the whole admin area down for the sake of a stat.
  const visitors=authenticated?await getAdminVisitorStat().catch(()=>null):null;
  return <>{authenticated?<nav className="app-shell admin-subnav" aria-label="Administration"><Link href="/admin">Moderation</Link><Link href="/admin/founder-emails">Founder emails</Link><AdminVisitorCount initial={visitors} dashboardUrl={config.vemetric.publicDashboardUrl}/></nav>:null}{children}</>
}
