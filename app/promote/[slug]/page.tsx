import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PromoteBooking } from "@/components/PromoteBooking";
import { currentUserFromHeaders } from "@/lib/auth";
import { config, isDodoConfigured, sponsorSavings, sponsorTiers } from "@/lib/config";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Promote your startup", robots: { index: false, follow: false } };

export default async function PromotePage({ params, searchParams }: PageProps<"/promote/[slug]"> & { searchParams: Promise<{ booking?: string }> }) {
  const [{ slug }, search, user] = await Promise.all([params, searchParams, currentUserFromHeaders(await headers()).catch(() => null)]);
  if (!user) redirect(`/sign-in?returnTo=${encodeURIComponent(`/promote/${slug}`)}`);
  const products = await query<{ id: string; name: string; status: string; minimum_start: Date }>(`SELECT p.id::text,p.name,p.status,now()+interval '30 minutes' AS minimum_start FROM products p WHERE p.slug=$1 AND EXISTS(SELECT 1 FROM product_owners po WHERE po.product_id=p.id AND po.user_id=$2)`, [slug, user.id]);
  const product = products[0];
  if (!product) notFound();
  const bookings = await query<{ id: string; booking_status: string; payment_status: string; start_at: Date; end_at: Date; duration_days: number; price_minor: number; impressions: number; clicks: number }>(`SELECT b.id::text,CASE WHEN b.payment_status IN ('paid','complimentary') AND b.start_at<=now() AND now()<b.end_at THEN 'active' WHEN b.payment_status IN ('paid','complimentary') AND now()>=b.end_at THEN 'completed' ELSE b.booking_status END AS booking_status,b.payment_status,b.start_at,b.end_at,b.duration_days,b.price_minor,count(e.*) FILTER(WHERE e.event_type='impression')::int AS impressions,count(e.*) FILTER(WHERE e.event_type='outbound_click')::int AS clicks FROM sponsor_bookings b LEFT JOIN sponsor_events e ON e.booking_id=b.id WHERE b.product_id=$1::uuid AND b.purchaser_id=$2 GROUP BY b.id ORDER BY b.created_at DESC`, [product.id, user.id]);
  return <main className="app-shell inner-page account-page"><header className="page-heading"><p className="eyebrow">Promote · {product.name}</p><h1>Promote this startup</h1><p>A clearly labelled placement across the homepage, the directory and other startup pages, with a report of impressions, outbound clicks and CTR. One-time payment, no automatic renewal, and it never affects your organic ranking.</p><Link className="text-link" href={`/manage/${slug}`}>← Back to product dashboard</Link></header>{product.status === "published" ? <PromoteBooking productId={product.id} minimumStart={product.minimum_start.toISOString()} enabled={isDodoConfigured()} selectedBookingId={search.booking} initialBookings={bookings.map((item) => ({ id: item.id, bookingStatus: item.booking_status, paymentStatus: item.payment_status, startAt: item.start_at.toISOString(), endAt: item.end_at.toISOString(), impressions: item.impressions, outboundClicks: item.clicks, durationDays: item.duration_days, priceMinor: item.price_minor }))} tiers={sponsorTiers().map((tier) => ({ days: tier.days, priceMinor: tier.priceMinor }))} savings={sponsorSavings()} slots={config.sponsorship.slots} /> : <div className="empty-state"><h2>Approval required</h2><p>Your startup must be approved and public before you can sponsor it. Payment never bypasses review.</p></div>}<section className="policy-note"><h2>Cancellation and service policy</h2><p>An unstarted booking can be cancelled for a full refund. Once a placement starts, cancellation stops future display without an automatic full refund. If FounderTrail cannot deliver a confirmed period because of a platform failure, an administrator will provide a make-good period or refund. Traffic or customers are never guaranteed.</p></section></main>;
}
