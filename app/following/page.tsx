import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { ProductLogo } from "@/components/ProductLogo";
import { currentUserFromHeaders } from "@/lib/auth";
import { getUpdateFeed } from "@/lib/foundertrail-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Following", robots: { index: false, follow: false } };

export default async function FollowingPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await currentUserFromHeaders(await headers()).catch(() => null);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent("/following")}`);
  const raw = (await searchParams).page;
  const feed = await getUpdateFeed(Math.max(1, Number.parseInt(raw ?? "1", 10) || 1), user.id, true);
  return <main className="app-shell inner-page account-page"><header className="page-heading"><p className="eyebrow">Following</p><h1>Updates from startups you follow</h1><p>See what founders are building, improving, and learning.</p></header>
    {feed.updates.length ? <div className="update-feed">{feed.updates.map((update) => <article key={update.id}><ProductLogo productName={update.productName} imageUrl={update.logoUrl} productUrl={null} className="product-list-logo"/><div><p><span className="status-pill">{update.type}</span> <LocalTime value={update.publishedAt.toISOString()} dateOnly/></p><h2><Link href={`/product/${update.productSlug}#updates`}>{update.title}</Link></h2><strong>{update.productName}</strong><p>{update.body}</p></div></article>)}</div> : <div className="empty-state"><h2>No followed updates yet</h2><p>Follow useful startups to collect their published progress here. Following does not subscribe you to promotional email.</p><Link className="button button-primary" href="/?view=discover#products">Explore startups</Link></div>}
    {feed.pageCount > 1 ? <nav className="pagination" aria-label="Pages">{feed.page > 1 ? <Link href={`/following?page=${feed.page - 1}`}>Previous</Link> : null}<span>Page {feed.page} of {feed.pageCount}</span>{feed.page < feed.pageCount ? <Link href={`/following?page=${feed.page + 1}`}>Next</Link> : null}</nav> : null}
  </main>;
}
