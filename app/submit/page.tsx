import type { Metadata } from "next";
import { SubmissionForm } from "@/components/SubmissionForm";
import { headers } from "next/headers";
import Link from "next/link";
import { currentUserFromHeaders } from "@/lib/auth";
import { brandCopy } from "@/lib/brand";

export const metadata: Metadata = { title: "Submit a startup", description: brandCopy.submissionIntroduction, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const user=await currentUserFromHeaders(await headers()).catch(()=>null);
  if(!user)return <main className="app-shell inner-page narrow-page"><header className="page-heading"><p className="eyebrow">Free startup profile</p><h1>Submit your startup.</h1><p>{brandCopy.submissionIntroduction}</p></header><div className="quiet-empty"><p>Sign in first so your draft and ownership request stay attached to your account.</p><Link className="button button-primary" href="/sign-in?returnTo=%2Fsubmit">Sign in to continue</Link></div></main>;
  return <main className="app-shell inner-page submit-page">
    <SubmissionForm accountName={user.name ?? ""} accountEmail={user.email ?? ""} />
  </main>;
}
