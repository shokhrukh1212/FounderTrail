import type { Metadata } from "next";
import Link from "next/link";
import { LegalContact } from "@/components/LegalContact";
import { config } from "@/lib/config";

export const metadata: Metadata = { title: "Terms of service", description: "The terms for using FounderTrail, listing a startup, and buying FounderTrail Pro." };

const UPDATED = "September 23, 2026";

export default function TermsPage() {
  return <main className="app-shell prose-page legal-page">
    <header className="page-heading"><p className="eyebrow">Legal</p><h1>Terms of service</h1><p>The rules for using {config.siteName}, listing a startup, and buying {config.siteName} Pro.</p><p className="legal-updated">Last updated {UPDATED}</p></header>

    <section><h2>Using {config.siteName}</h2><p>By using {config.siteName} you agree to these terms and to our <Link href="/privacy">privacy policy</Link>. If you use it for a company, you confirm you can accept these terms on its behalf.</p></section>

    <section><h2>Your account</h2><p>You sign in with Google and are responsible for what happens under your account. Keep your details accurate and don&apos;t share your account or create accounts to get around limits or bans.</p></section>

    <section><h2>Listing a startup</h2><p>Only submit or claim startups you built or are authorised to represent, and keep their details accurate. We review submissions and may approve, reject, edit for clarity (for example names, categories or formatting), archive or remove listings that are misleading, unsafe, duplicated, unlawful or abandoned.</p></section>

    <section><h2>Your content</h2><p>You keep ownership of what you post: listing details, logos, screenshots, updates and comments. You give {config.siteName} a worldwide, non-exclusive, royalty-free licence to host, display, reproduce and share that content to run and promote the service, including on share images, social posts and emails about your listing. You confirm you have the rights to everything you upload.</p></section>

    <section><h2>Community rules</h2><p>Don&apos;t manipulate upvotes, follows, clicks, launch results or reports. That includes using fake accounts or paid voting. No spam, harassment, impersonation or unlawful content, and no attempts to break, overload or get into the service or other people&apos;s accounts. See the <Link href="/about#submission-guidelines">submission guidelines</Link>. We may remove content and suspend accounts that break these rules.</p></section>

    <section><h2>Rankings and launches</h2><p>Rankings and weekly launch results come from community activity. No purchase, including {config.siteName} Pro, buys placement, votes or approval.</p></section>

    <section><h2>{config.siteName} Pro</h2><ul>
      <li>Pro is a one-time purchase for one startup. It is not a subscription. It adds editable launch graphics and social posts, one private seven-day results summary, and a Pro badge.</li>
      <li>The price is shown before checkout. Taxes may be added at checkout. Payments are processed by Dodo Payments as merchant of record, under its own terms.</li>
      <li>Pro is delivered as soon as payment is confirmed. Purchases are final once Pro is active, except where the law requires a refund or we choose to give one.</li>
      <li>If a payment is refunded or reversed through a chargeback, Pro is removed from that startup.</li>
      <li>We may improve or change Pro features over time without reducing what you paid for.</li>
    </ul></section>

    <section><h2>No guarantees</h2><p>{config.siteName} is provided &ldquo;as is&rdquo;. We work to keep it available and accurate, but we don&apos;t guarantee uninterrupted service, error-free data, or any traffic, customers, revenue or other result from a listing, launch or purchase. Activity numbers describe events we recorded, not visits or sales.</p></section>

    <section><h2>Liability</h2><p>To the extent the law allows, {config.siteName} is not liable for indirect, incidental or consequential losses. Our total liability for any claim is limited to the amount you paid us in the twelve months before the claim. Nothing in these terms limits rights you have under law that cannot be waived.</p></section>

    <section><h2>Ending use</h2><p>You can stop using {config.siteName} and delete your account from <Link href="/settings">Settings</Link> at any time. We may suspend or end access for serious or repeated breaches of these terms.</p></section>

    <section><h2>Changes and contact</h2><p>We may update these terms and will change the date above when we do. Continuing to use {config.siteName} after an update means you accept it.</p><LegalContact topic="terms" /></section>
  </main>;
}
