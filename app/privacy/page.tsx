import { publicPageMetadata } from "@/lib/seo";
import Link from "next/link";
import { LegalContact } from "@/components/LegalContact";
import { config } from "@/lib/config";

export const metadata = publicPageMetadata("/privacy", "Privacy policy", "How FounderTrail collects, uses and protects your information, including the Google account data used for sign-in.");

const UPDATED = "September 23, 2026";

export default function PrivacyPage() {
  return <main className="app-shell prose-page legal-page">
    <header className="page-heading"><p className="eyebrow">Legal</p><h1>Privacy policy</h1><p>How {config.siteName} collects, uses and protects your information.</p><p className="legal-updated">Last updated {UPDATED}</p></header>

    <section><h2>Who we are</h2><p>{config.siteName} is a community for discovering startups, launching them, and following their progress. This policy covers the {config.siteName} website and the accounts, listings and purchases made on it.</p></section>

    <section><h2>Information you give us</h2><ul>
      <li><strong>Account details.</strong> When you sign in with Google we receive your name, email address and profile picture.</li>
      <li><strong>Listings.</strong> For a startup you submit or claim: its name, website, description, categories, pricing, logo and screenshots, and optionally a founder name and X handle, plus a private contact email.</li>
      <li><strong>Community activity.</strong> Comments, replies, upvotes, follows and founder updates.</li>
      <li><strong>Ownership checks.</strong> The file or tag you publish on your domain to prove you control it.</li>
      <li><strong>Preferences.</strong> Your email choices, such as the weekly digest or founder news.</li>
    </ul></section>

    <section><h2>Google account data</h2><p>We request only Google&apos;s basic sign-in scopes: <code>openid</code>, <code>email</code> and <code>profile</code>. We use them to create and sign in to your account, to show your name next to comments you post, and to contact you about your account, listings and purchases. We do not access your Gmail, contacts, calendar, files or any other Google data.</p><p>We do not sell Google user data, use it for advertising, or share it except with the service providers listed below that we need to run {config.siteName}. Our use of information received from Google APIs follows the <a href="https://developers.google.com/terms/api-services-user-data-policy" rel="noopener noreferrer" target="_blank">Google API Services User Data Policy</a>, including its Limited Use requirements.</p></section>

    <section><h2>Information collected automatically</h2><ul>
      <li><strong>Cookies.</strong> A session cookie keeps you signed in. A pseudonymous visitor cookie lets us count product-page views and outbound website clicks once per browser and detect abuse.</li>
      <li><strong>Security and abuse data.</strong> IP addresses and browser details are used for rate limiting and fraud prevention, stored as one-way hashes where we can, and kept with your sign-in sessions.</li>
      <li><strong>Analytics.</strong> We use privacy-focused website analytics to understand overall traffic. When we run advertising campaigns we may also use the Meta or X measurement pixel.</li>
    </ul></section>

    <section><h2>How we use information</h2><p>To run your account and listings; show startup pages and community activity; review submissions and prevent spam, fraud and vote manipulation; give founders aggregate activity numbers for their own startups; send service emails such as approvals, ownership results and receipts; send optional emails you have opted into; and process FounderTrail Pro purchases.</p></section>

    <section><h2>What is public</h2><p>Published startup listings, including any founder name and X handle you add, founder updates, and your comments with your name are public. Upvote and follower totals are public; who upvoted or followed is not. Your email address and a listing&apos;s private contact email are never shown publicly.</p></section>

    <section><h2>Who we share it with</h2><p>We do not sell personal information. We share it only with providers that help us run the service, under their own privacy terms:</p><ul>
      <li>Vercel (hosting) and Neon (database)</li>
      <li>Amazon Web Services (storage for logos and screenshots)</li>
      <li>Google (sign-in)</li>
      <li>Resend (email delivery)</li>
      <li>Dodo Payments (payments, as merchant of record; we never see your full card details)</li>
      <li>Our analytics provider, and Meta or X only while a measurement pixel is in use</li>
    </ul><p>We may also disclose information when the law requires it, or to protect our users and the service.</p></section>

    <section><h2>Retention and deletion</h2><p>We keep information for as long as your account or listing is active. You can delete your account from <Link href="/settings">Settings</Link>. Deleting it removes your sign-in details, name and email; your public comments stay but are shown as from a &ldquo;Deleted member&rdquo;. We keep payment, moderation and security records where the law or fraud prevention requires it. To remove a listing, contact us.</p></section>

    <section><h2>Your choices</h2><p>You can change email preferences in <Link href="/settings">Settings</Link> or from the link in any optional email, edit your listings from your dashboard, and block or clear cookies in your browser (signing in requires the session cookie). Depending on where you live, you may have the right to access, correct, export or delete your information; contact us to use them.</p></section>

    <section><h2>Security and children</h2><p>We use encryption in transit, access controls and one-way hashing to protect information, though no service can guarantee complete security. {config.siteName} is not directed at children under 16, and we do not knowingly collect their information.</p></section>

    <section><h2>Changes and contact</h2><p>If we change this policy we will update the date above, and tell signed-in users about significant changes.</p><LegalContact topic="privacy" /></section>
  </main>;
}
