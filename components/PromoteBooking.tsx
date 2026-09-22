"use client";

import { useEffect, useState } from "react";

type Booking = { id: string; bookingStatus: string; paymentStatus: string; startAt: string; endAt: string; impressions: number; outboundClicks: number };

function localInputValue(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function PromoteBooking({ productId, minimumStart, enabled, selectedBookingId, initialBookings }: { productId: string; minimumStart: string; enabled: boolean; selectedBookingId?: string; initialBookings: Booking[] }) {
  const minimum = localInputValue(new Date(minimumStart));
  const [start, setStart] = useState(minimum);
  const [bookings, setBookings] = useState(initialBookings);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selected = bookings.find((booking) => booking.id === selectedBookingId);
  const end = Number.isFinite(new Date(start).getTime()) ? new Date(new Date(start).getTime() + 168 * 60 * 60 * 1000) : null;

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
    const response = await fetch("/api/sponsor/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, startAt: startAt.toISOString() }) });
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

  return <div className="promote-layout"><section className="settings-card promote-preview"><p className="eyebrow">Placement preview</p><span className="sponsored-label">Sponsored</span><h2>Your approved product identity</h2><p>The same clearly labelled card appears in the desktop rail and after the third organic result on mobile, on This week and Discover only.</p><dl><div><dt>Price</dt><dd>$9 USD base price · tax shown by Dodo at checkout</dd></div><div><dt>Duration</dt><dd>168 consecutive hours</dd></div><div><dt>Renewal</dt><dd>None</dd></div><div><dt>Report</dt><dd>Qualified displays and outbound clicks</dd></div></dl></section>
    <section className="settings-card"><h2>Choose a start</h2><p>Checkout holds this exact period for 15 minutes. A payment received after an expired or conflicting hold is recorded for refund and never displaces another sponsor.</p><label>Start in your timezone<input type="datetime-local" min={minimum} value={start} onChange={(event) => setStart(event.target.value)} /></label>{end ? <p><strong>Ends:</strong> {end.toLocaleString()} <small>({end.toISOString()} UTC)</small></p> : null}<button className="button button-primary" disabled={!enabled || busy} onClick={() => void checkout()}>{busy ? "Opening checkout…" : "Continue to secure checkout"}</button>{!enabled ? <p className="manager-notice">Sponsorship booking is not available yet. The Dodo provider configuration must be completed by an administrator.</p> : null}{message ? <p role="status" className="form-message">{message}</p> : null}</section>
    {selected ? <section className="settings-card booking-highlight"><h2>Checkout status</h2><p><strong>{selected.bookingStatus.replaceAll("_", " ")}</strong> · payment {selected.paymentStatus.replaceAll("_", " ")}</p><p>A browser return does not confirm payment. This status is updated only from verified Dodo evidence.</p></section> : null}
    <section className="settings-card booking-history"><h2>Campaigns</h2>{bookings.length ? bookings.map((booking) => <article key={booking.id}><div><strong>{booking.bookingStatus.replaceAll("_", " ")}</strong><span>Payment: {booking.paymentStatus.replaceAll("_", " ")}</span></div><p>{new Date(booking.startAt).toLocaleString()} → {new Date(booking.endAt).toLocaleString()}</p><dl><div><dt>Qualified displays</dt><dd>{booking.impressions.toLocaleString()}</dd></div><div><dt>Outbound clicks</dt><dd>{booking.outboundClicks.toLocaleString()}</dd></div></dl>{["held","scheduled","active"].includes(booking.bookingStatus) ? <button className="text-button" disabled={busy} onClick={() => void cancel(booking.id)}>Cancel booking</button> : null}</article>) : <div className="quiet-empty">No sponsorship campaigns yet.</div>}</section>
  </div>;
}
