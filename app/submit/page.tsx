import type { Metadata } from "next";
import { SubmissionForm } from "@/components/SubmissionForm";

export const metadata: Metadata = { title: "Submit a product", description: "Launch a bidding product on BidIndex for free." };
export const dynamic = "force-dynamic";

export default function SubmitPage() {
  return <main className="app-shell inner-page submit-page">
    <SubmissionForm />
  </main>;
}
