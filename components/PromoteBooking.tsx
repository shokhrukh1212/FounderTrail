"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Booking = { id: string; bookingStatus: string; paymentStatus: string; startAt: string; endAt: string; impressions: number; outboundClicks: number; durationDays: number; priceMinor: number };
type Tier = { days: number; priceMinor: number };

function money(minor: number): string {
  return `$${(minor / 100).toFixed(minor % 100 === 0 ? 0 : 2)}`;
}

function ctr(clicks: number, impressions: number): string {
  return impressions > 0 ? `${((clicks / impressions) * 100).toFixed(1)}%` : "—";
}

function localInputValue(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function PromoteBooking({ productId, minimumStart, enabled, selectedBookingId, initialBookings, tiers, savings, slots }: { productId: string; minimumStart: string; enabled: boolean; selectedBookingId?: string; initialBookings: Booking[]; tiers: Tier[]; savings: { savedMinor: number; percent: number; periods: number } | null; slots: number }) {
  const minimum = localInputValue(new Date(minimumStart));
  const [start, setStart] = useState(minimum);
  const [durationDays, setDurationDays] = useState(tiers[0]?.days ?? 7);
  const tier = tiers.find((item) => item.days === durationDays) ?? tiers[0];
  const [bookings, setBookings] = useState(initialBookings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = bookings.find((booking) => booking.id === selectedBookingId);
  const end = tier && Number.isFinite(new Date(start).getTime())
    ? new Date(new Date(start).getTime() + tier.days * 24 * 60 * 60 * 1000)
    : null;

  useEffect(() => {
    if (!selectedBookingId) return;
    let attempts = 0;
    const poll = async () => {
      const response = await fetch(`/api/sponsor/bookings/${selectedBookingId}`, { cache: "no-store" });
      if (response.ok) {
        const booking = await response.json() as Booking;
        setBookings((current) => [booking, ...current.filter((item) => item.id !== booking.id)]);
        if (["paid","refunded","failed","cancelled","conflict"].includes(booking.paymentStatus)) return;
      }
      attempts += 1;
      if (attempts < 20) window.setTimeout(() => void poll(), 3000);
    };
    void poll();
  }, [selectedBookingId]);

  async function checkout() {
    setBusy(true); setMessage("");
    const startAt = new Date(start);
    const response = await fetch("/api/sponsor/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, startAt: startAt.toISOString(), durationDays }) });
    const result = await response.json() as { checkoutUrl?: string; error?: string };
    if (response.ok && result.checkoutUrl) { location.assign(result.checkoutUrl); return; }
    setMessage(result.error ?? "Could not open checkout."); setBusy(false);
  }

  async function cancel(bookingId: string) {
    if (!window.confirm("Cancel this booking? Unstarted paid bookings receive a full provider refund. Once a placement starts, cancellation stops future display without an automatic full refund.")) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/sponsor/bookings/${bookingId}`, { method: "DELETE" });
    const result = await response.json() as { status?: string; error?: string; message?: string };
    setMessage(result.message ?? (response.ok ? `Booking ${result.status}.` : result.error ?? "Could not cancel."));
    if (response.ok) location.reload(); else setBusy(false);
  }

  return <div className="promote-layout">
    <section className="settings-card promote-preview">
      <p className="eyebrow">Placement preview</p>
      <span className="sponsor-label">Promoted</span>
      <h2>Your approved startup identity</h2>
      <p>The same clearly labelled creative appears in <strong>Featured sponsors</strong> on the homepage, as a row in the directory after organic results 3, 8 and 13, and as one card on other startups&apos; pages. It never appears on your own page and never changes organic ranking.</p>
      <dl>
        <div><dt>Price</dt><dd>{tier ? money(tier.priceMinor) : "—"} USD one-time · tax shown by Dodo at checkout</dd></div>
        <div><dt>Duration</dt><dd>{tier ? `${tier.days} consecutive days` : "—"}</dd></div>
        <div><dt>Renewal</dt><dd>None. Nothing recurs.</dd></div>
        <div><dt>Report</dt><dd>Impressions, outbound clicks, CTR, placement breakdown and a daily trend</dd></div>
      </dl>
      <p className="form-hint">Your outbound link is marked <code>rel=&quot;sponsored&quot;</code>. Results are traffic signals, not guaranteed customers.</p>
    </section>

    <section className="settings-card">
      <h2>Choose a length</h2>
      <div className="advertise-tiers">
        {tiers.map((item) => <label key={item.days} className={`advertise-tier${item.days === durationDays ? " is-selected" : ""}`}>
          <input type="radio" name="durationDays" value={item.days} checked={item.days === durationDays} onChange={() => setDurationDays(item.days)} />
          <strong>{item.days} days</strong>
          <span className="advertise-price">{money(item.priceMinor)}</span>
          {savings && item.days === tiers[tiers.length - 1]?.days
            ? <span className="advertise-saving">Save {money(savings.savedMinor)} ({savings.percent}%) versus {savings.periods} separate {tiers[0]?.days}-day placements</span>
            : null}
        </label>)}
      </div>

      <h2>Choose a start</h2>
      <p>There are {slots} placements site-wide. Checkout holds this exact period for 15 minutes. A payment received after an expired or conflicting hold is recorded for refund and never displaces another sponsor.</p>
      <label>Start in your timezone<input type="datetime-local" min={minimum} value={start} onChange={(event) => setStart(event.target.value)} /></label>
      {end ? <p><strong>Ends:</strong> {end.toLocaleString()} <small>({end.toISOString()} UTC)</small></p> : null}
      <button className="button button-primary" disabled={!enabled || busy || !tier} onClick={() => void checkout()}>{busy ? "Opening checkout…" : `Continue to secure checkout${tier ? ` — ${money(tier.priceMinor)}` : ""}`}</button>
      {!enabled ? <p className="manager-notice">Sponsorship booking is not available yet. The Dodo provider configuration must be completed by an administrator.</p> : null}
      {message ? <p role="status" className="form-message">{message}</p> : null}
    </section>
    {selected ? <section className="settings-card booking-highlight"><h2>Checkout status</h2><p><strong>{selected.bookingStatus.replaceAll("_", " ")}</strong> · payment {selected.paymentStatus.replaceAll("_", " ")}</p><p>A browser return does not confirm payment. This status is updated only from verified Dodo evidence.</p></section> : null}
    <section className="settings-card booking-history"><h2>Campaigns</h2>{bookings.length ? bookings.map((booking) => <article key={booking.id}><div><strong>{booking.bookingStatus.replaceAll("_", " ")}</strong><span>Payment: {booking.paymentStatus.replaceAll("_", " ")}</span></div><p>{new Date(booking.startAt).toLocaleString()} → {new Date(booking.endAt).toLocaleString()}</p><dl><div><dt>Impressions</dt><dd>{booking.impressions.toLocaleString()}</dd></div><div><dt>Outbound clicks</dt><dd>{booking.outboundClicks.toLocaleString()}</dd></div><div><dt>CTR</dt><dd>{ctr(booking.outboundClicks, booking.impressions)}</dd></div><div><dt>Length</dt><dd>{booking.durationDays} days · {money(booking.priceMinor)}</dd></div></dl><p className="form-hint"><Link className="text-link" href={`/promote/report/${booking.id}`}>Full report →</Link></p>{["held","scheduled","active"].includes(booking.bookingStatus) ? <button className="text-button" disabled={busy} onClick={() => void cancel(booking.id)}>Cancel booking</button> : null}</article>) : <div className="quiet-empty">No sponsorship campaigns yet.</div>}</section>
  </div>;
}
