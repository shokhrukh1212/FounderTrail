import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/AccountSettings";
import { currentUserFromHeaders } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent("/settings")}`);
  const rows = await query<{ digest_opted_in: boolean }>(`SELECT digest_opted_in FROM app_users WHERE id=$1`, [user.id]);
  return <main className="app-shell inner-page account-page"><header className="page-heading"><p className="eyebrow">Account</p><h1>Settings</h1><p>{user.email}</p></header><AccountSettings initialDigest={Boolean(rows[0]?.digest_opted_in)} /></main>;
}
