import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

const sources = [
  ["Verified live", "Received through an authenticated partner integration."],
  ["Verified by BidIndex", "Measured directly by BidIndex, such as an eligible outbound click."],
  ["Publicly sourced", "Copied from a linked public source by an administrator."],
  ["Founder reported", "Provided by the owner without technical verification."],
  ["Unavailable", "No usable number has been supplied or measured."],
];

export default function AboutPage() {
  return (
    <main className="app-shell prose-page">
      <header className="page-heading">
        <p className="eyebrow">About BidIndex</p>
        <h1>The live, verified discovery platform for bidding products.</h1>
        <p>BidIndex brings launches, community interest, founder updates, and honestly sourced live numbers into one focused directory.</p>
      </header>
      <section>
        <h2>Built for a small, unusual ecosystem</h2>
        <p>We focus on pay-to-rank directories, attention marketplaces, bidding games, public sponsorship experiments, and closely related products. Submission is free. Community votes and verified activity decide organic visibility.</p>
      </section>
      <section>
        <h2>What each metric label means</h2>
        <dl className="definition-list">{sources.map(([term, definition]) => <div key={term}><dt>{term}</dt><dd>{definition}</dd></div>)}</dl>
        <p>Domain ownership is separate from metric verification. Verifying a website never verifies its revenue automatically.</p>
      </section>
      <section>
        <h2>Organic means organic</h2>
        <p>Payments, legacy bids, founder-reported values, and future promotions do not improve upvote, trending, launch, or verified-data rankings. Any future paid placement will be clearly labelled <strong>Promoted</strong>.</p>
      </section>
      <section className="about-cta"><h2>Building something that belongs here?</h2><Link className="button button-primary" href="/submit">Submit your product — free</Link></section>
    </main>
  );
}
