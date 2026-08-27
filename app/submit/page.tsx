import type { Metadata } from "next";
import { SubmissionForm } from "@/components/SubmissionForm";
import { query } from "@/lib/db";

export const metadata: Metadata = { title: "Submit a product — BidIndex", description: "Launch a bidding product on BidIndex for free." };
export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const categories = await query<{ slug: string; name: string }>(`SELECT slug, name FROM categories ORDER BY name`);
  return <main className="app-shell inner-page submit-page">
    <header className="page-heading"><p className="eyebrow">Free product launch</p><h1>Submit your bidding product.</h1><p>Share the essentials now. Verification and the partner integration can be completed after moderation.</p></header>
    <SubmissionForm categories={categories} />
  </main>;
}
