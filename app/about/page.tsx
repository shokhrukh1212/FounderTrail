import type { Metadata } from "next";
import Link from "next/link";
import { brandCopy } from "@/lib/brand";

export const metadata: Metadata = { title: "About", description: brandCopy.mediumDescription };

const sources = [
  ["Measured by BidIndex", "Directly measured by BidIndex, such as eligible outbound clicks and privacy-conscious badge traffic."],
  ["Processor verified", "Received through a future official payment-provider connection. This label is never used without a real processor connection."],
  ["Partner connected", "Sent by the product’s authenticated server. Authentication identifies the partner but does not independently audit its business."],
  ["Publicly sourced", "Taken from a linked public page reviewed by an administrator."],
  ["Founder reported", "Provided by the owner without technical verification."],
  ["Unavailable", "No usable number has been supplied or measured."],
];

export default function AboutPage() {
  return (
    <main className="app-shell prose-page">
      <header className="page-heading">
        <p className="eyebrow">About BidIndex</p>
        <h1>{brandCopy.definition}</h1>
        <p>{brandCopy.mediumDescription}</p>
      </header>
      <section>
        <h2>{brandCopy.concept}</h2>
        {brandCopy.longDescription.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </section>
      <section>
        <h2>What each metric label means</h2>
        <dl className="definition-list">{sources.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl>
        <p>A Verified product has both confirmed domain ownership and a detected BidIndex badge. That status never verifies revenue automatically; every metric keeps its own source label.</p>
      </section>
      <section>
        <h2>Organic means organic</h2>
        <p>Payments, legacy bids, founder-reported values, and future promotions do not improve upvote, trending, launch, or verified-data rankings. Any future paid placement will be clearly labelled <strong>Promoted</strong>.</p>
      </section>
      <section id="submission-guidelines">
        <h2>Submission guidelines</h2>
        <p>BidIndex accepts bidding-related products: pay-to-rank directories, ad auctions and digital billboards, sponsorship marketplaces, bidding games, and closely related experiments. Do not submit malware, scams, impersonations, or unrelated products. BidIndex may edit metadata for clarity, approval is not guaranteed, and submission is currently free. Paid promotion never changes organic rankings.</p>
      </section>
      <section className="about-cta"><h2>Building something that belongs here?</h2><Link className="button button-primary" href="/submit">Submit your product — free</Link></section>
    </main>
  );
}
