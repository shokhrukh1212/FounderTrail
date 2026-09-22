import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { LaunchStudio } from "@/components/LaunchStudio";
import { currentUserFromHeaders } from "@/lib/auth";
import { config } from "@/lib/config";
import { query } from "@/lib/db";
import { defaultLaunchKitDraft, type LaunchFacts } from "@/lib/launch-kit";
import { getProAvailability } from "@/lib/pro-launch";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pricing", description: "Create a FounderTrail startup page for free, or add professional launch tools with a one-time Pro upgrade." };

const previewFacts: LaunchFacts = { name: "Your startup", tagline: "A clear way to introduce what you are building.", useCase: "Share the problem you solve and invite useful feedback.", audience: "early supporters", websiteUrl: "https://example.com", founderTrailUrl: `${config.siteUrl}/product/your-startup`, launchState: "upcoming" };

export default async function PricingPage() {
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  const [availability, owned] = await Promise.all([
    getProAvailability(),
    user ? query<{ slug: string; name: string; status: string; entitlement_status: string | null }>(
      `SELECT p.slug,p.name,p.status,e.status AS entitlement_status FROM products p
       JOIN product_owners po ON po.product_id=p.id AND po.user_id=$1
       LEFT JOIN pro_entitlements e ON e.product_id=p.id ORDER BY p.created_at DESC`, [user.id],
    ) : Promise.resolve([]),
  ]);
  const intro = availability.available > 0;
  return <main className="app-shell inner-page pricing-page">
    <header className="page-heading pricing-heading"><p className="eyebrow">Simple pricing</p><h1>A free home for your startup. Better launch tools with Pro.</h1><p>Create your page for free. Upgrade for editable launch graphics, ready-to-share post drafts, a clear results summary, and a Pro badge.</p></header>
    <section className="pricing-grid" aria-label="FounderTrail plans">
      <article className="pricing-card"><p className="eyebrow">Free</p><div className="pro-price"><strong>Free</strong></div><p>Everything needed to join the community and keep your startup page useful.</p><ul><li>Public startup page</li><li>Normal launch scheduling</li><li>Community upvotes, discussion, and follows</li><li>Founder updates and basic statistics</li><li>Screenshots and ordinary website links</li></ul><Link className="button button-secondary" href={user ? "/my-products" : "/submit"}>{user ? "Manage my startups" : "Submit for free"}</Link></article>
      <article className="pricing-card is-pro"><p className="eyebrow">Pro Launch</p><div className="pro-price"><strong>${availability.currentPriceMinor / 100}</strong><span>one-time / per startup</span></div><p>{intro ? "First 20 startup purchases: $5. Then $9." : "The $5 introductory offer has ended."}</p>{intro ? <p className="pro-availability"><strong>{availability.available} of 20 introductory upgrades available</strong>{availability.reserved ? ` · ${availability.reserved} temporarily reserved` : ""}</p> : null}<ul><li><strong>Editable launch graphics</strong> — professional layouts, ready to download.</li><li><strong>Editable social posts</strong> — adapt and copy drafts for your launch.</li><li><strong>Seven-day results summary</strong> — understand activity around your startup.</li><li><strong>Pro badge</strong> — visible beside your startup&apos;s name.</li></ul><a className="button button-secondary" href="#launch-kit-preview">Preview launch kit</a></article>
    </section>
    {owned.length ? <section className="settings-card owned-upgrade-list"><h2>Choose one of your startups</h2>{owned.map((product) => <article key={product.slug}><div><strong>{product.name}</strong><small>{product.status.replaceAll("_", " ")}</small></div>{product.entitlement_status === "active" ? <Link className="button button-secondary" href={`/manage/${product.slug}/launch-kit`}>Open launch kit</Link> : product.status === "published" ? <Link className="button button-primary" href={`/manage/${product.slug}/pro`}>Upgrade to Pro</Link> : <span className="status-pill">Approval required</span>}</article>)}</section> : <section className="pricing-next-step"><h2>{user ? "Upgrade after your startup is approved" : "Ready to start?"}</h2><p>{user ? "Submit or claim a startup first. Pending and rejected listings cannot be charged." : "Sign in with Google to submit or claim a startup. Browsing and submission remain free."}</p><div className="button-row"><Link className="button button-primary" href={user ? "/submit" : `/sign-in?returnTo=${encodeURIComponent("/pricing")}`}>{user ? "Submit a startup" : "Sign in to continue"}</Link><Link className="button button-secondary" href="/?view=discover#products">Explore startups</Link></div></section>}
    <section id="launch-kit-preview" className="pricing-preview"><header><p className="eyebrow">Real launch-kit preview</p><h2>Designed for a polished announcement</h2><p>This preview uses the same Canvas renderer as the paid editor. Pro owners can edit every meaningful word, switch layouts and formats, save the draft, and download the PNG.</p></header><LaunchStudio slug="preview" facts={previewFacts} initialDraft={defaultLaunchKitDraft(previewFacts)} initialVersion={0} sources={[]} canEdit={false} previewOnly /></section>
    <section className="pricing-faq"><h2>Questions</h2><details><summary>Is Pro account-wide?</summary><p>No. One purchase upgrades one startup. Other startups on the same account remain Free unless upgraded separately.</p></details><details><summary>Does Pro renew?</summary><p>No. It is a one-time purchase, not a subscription.</p></details><details><summary>What happens to my existing listing?</summary><p>Its URL, ownership, content, votes, followers, comments, updates, analytics, and launch history remain unchanged.</p></details><details><summary>What does the badge mean?</summary><p>It identifies the startup&apos;s Pro plan. It is not identity, revenue, quality, or editorial verification.</p></details><details><summary>Does Pro improve ranking or review treatment?</summary><p>No. Placement, organic order, launch eligibility, links, moderation, and approval treatment are unchanged.</p></details><details><summary>What report is included?</summary><p>One private seven-day summary based on FounderTrail&apos;s recorded views, outbound clicks, net community activity, and visible comments. It does not claim that Pro caused the activity.</p></details><details><summary>Are taxes included?</summary><p>The displayed price is the base price. Applicable taxes and the final total are shown in hosted checkout before payment.</p></details></section>
  </main>;
}
