import type { Metadata } from "next";
import Link from "next/link";
import { brand, brandCopy } from "@/lib/brand";

export const metadata: Metadata = { title: "About", description: brandCopy.mediumDescription };

const sources = [
  ["Measured by FounderTrail", "Directly measured by FounderTrail, such as eligible profile views and outbound clicks."],
  ["Partner connected", "Sent by the product’s authenticated server. Authentication identifies the partner but does not independently audit its business."],
  ["Publicly sourced", "Taken from a linked public page reviewed by an administrator."],
  ["Founder reported", "Provided by the owner without technical verification."],
  ["Unavailable", "No usable number has been supplied or measured."],
];

export default function AboutPage() {
  return (
    <main className="app-shell prose-page">
      <header className="page-heading">
        <p className="eyebrow">About {brand.displayName}</p>
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
        <p>Confirmed ownership means a founder proved control of the startup domain or completed a documented manual review. It does not verify revenue; every shared metric keeps its own source, scope, currency, period, and refresh time.</p>
      </section>
      <section>
        <h2>Organic means organic</h2>
        <p>Launch votes rank only the current weekly cohort. Pro status, legacy support, founder-reported values, and connected metrics never improve organic launch order. FounderTrail does not sell placement in this release.</p>
      </section>
      <section id="submission-guidelines">
        <h2>Submission guidelines</h2>
        <p>FounderTrail accepts useful software and technology startups across categories. Submit a real, publicly reachable product with an accurate identity, clear purpose, working website, and a founder or authorized representative. We reject malware, scams, impersonation, misleading claims, prohibited or illegal products, thin affiliate pages, and duplicate listings. Valid new submissions publish immediately and stay attached to the submitter’s account. Management access is not proof of company ownership. We may hide abuse or edit metadata for clarity after publication. Publication and launching are free; Pro never changes organic rankings.</p>
      </section>
      <section><h2>How launch weeks work</h2><p>Approved startups may schedule one initial FounderTrail launch. Weeks run Monday 00:00 UTC through the following Monday. Joining the current week does not promise seven full days. Signed-in members can cast one active vote per launch and undo it before the week ends; final results are frozen using votes, approval time, then product ID as a stable tie-break.</p></section>
      <section><h2>Privacy and Pro</h2><p>Following a startup is not marketing consent. Founder updates appear on-site and in an optional weekly digest. Pro is a one-time launch-tools purchase for a published startup. It adds private creative tools and a factual seven-day results summary; it does not promise traffic or customers.</p></section>
      <section className="about-cta"><h2>Building something that belongs here?</h2><Link className="button button-primary" href="/submit">Submit your startup — free</Link></section>
    </main>
  );
}
