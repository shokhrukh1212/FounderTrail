import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", description: "How FounderTrail handles account, submission, and usage data." };

export default function PrivacyPage() {
  return <main className="app-shell prose-page"><header className="page-heading"><p className="eyebrow">Legal</p><h1>Privacy</h1><p>How FounderTrail handles the information needed to run the community.</p></header>
    <section><h2>Information we use</h2><p>FounderTrail stores the basic Google profile details needed for account access, product submissions and ownership, comments, upvotes, follows, moderation, and optional founder communications. Private contact details are not shown on public product pages.</p></section>
    <section><h2>Measurement</h2><p>We record qualified product-page and outbound-link activity using pseudonymous identifiers and abuse controls. Public click totals describe activations of a startup&apos;s website link; they are not confirmed visits, customers, or sales.</p></section>
    <section><h2>Providers and choices</h2><p>Google provides sign-in. Dodo Payments processes optional sponsored-placement purchases. Other optional integrations are used only when enabled for the relevant feature. You can update email preferences or request account deletion from Settings.</p></section>
  </main>;
}
