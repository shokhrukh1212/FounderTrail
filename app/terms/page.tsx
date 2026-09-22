import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms", description: "FounderTrail community and listing terms." };

export default function TermsPage() {
  return <main className="app-shell prose-page"><header className="page-heading"><p className="eyebrow">Legal</p><h1>Terms</h1><p>Simple rules for using FounderTrail.</p></header>
    <section><h2>Accurate participation</h2><p>Submit only products you built or are authorized to represent. Keep descriptions, pricing, ownership claims, and public evidence accurate. Do not manipulate upvotes, clicks, launch scores, reports, or account access.</p></section>
    <section><h2>Listings and moderation</h2><p>FounderTrail may review, correct, reject, archive, or remove misleading, unsafe, duplicate, unlawful, or abandoned listings. A sponsored placement is labelled, lasts for the purchased period, and never changes organic votes or ranking.</p></section>
    <section><h2>Community conduct</h2><p>Use discussions for constructive questions and feedback. Harassment, impersonation, spam, and attempts to compromise other users or services are not allowed. See the <Link href="/about#submission-guidelines">submission guidelines</Link> for more detail.</p></section>
  </main>;
}
