import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { AdminLogin } from "@/components/AdminLogin";
import { currentUserFromHeaders } from "@/lib/auth";
import { ADMIN_COOKIE, validAdminSession } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Admin recovery", robots: { index: false, follow: false } };

export default async function AdminRecoveryPage() {
  const [user, cookieStore] = await Promise.all([currentUserFromHeaders(await headers()).catch(() => null), cookies()]);
  if (user?.role === "admin" || validAdminSession(cookieStore.get(ADMIN_COOKIE)?.value ?? null)) redirect("/admin");
  return <main className="app-shell inner-page"><AdminLogin /></main>;
}
