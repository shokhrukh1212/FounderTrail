import "server-only";
import { Resend } from "resend";
import { brand } from "./brand";
import { config, isDodoProviderConfigured } from "./config";
import { query, withTransaction } from "./db";
import { digestUnsubscribeToken } from "./digest";
import { getDodoClient } from "./dodo";
import { formatEmailFrom } from "./email-sender";
import { processDodoEvent } from "./sponsorship";
import { processProDodoEvent, proOrderForEvent } from "./pro-launch";
import { finalizeDueProReports } from "./pro-results";

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character); }
function emailFrom() { return formatEmailFrom(config.email.from); }

async function maintainBookingStates() {
  const expired = await query(`UPDATE sponsor_bookings SET booking_status='expired_hold',payment_status='cancelled',updated_at=now() WHERE booking_status='held' AND payment_status IN ('pending','processing') AND hold_expires_at<=now() RETURNING id`);
  // An audited complimentary campaign carries no payment, so it has to be activated and
  // completed on the same schedule as a paid one or it would simply never run.
  const active = await query(`UPDATE sponsor_bookings SET booking_status='active',updated_at=now() WHERE payment_status IN ('paid','complimentary') AND booking_status='scheduled' AND start_at<=now() AND now()<end_at RETURNING id`);
  const completed = await query(`UPDATE sponsor_bookings SET booking_status='completed',updated_at=now() WHERE payment_status IN ('paid','complimentary') AND booking_status IN ('scheduled','active') AND end_at<=now() RETURNING id`);
  return { expired: expired.length, active: active.length, completed: completed.length };
}

async function archiveLaunchWeeks() {
  return withTransaction(async (client) => {
    const weeks = await client.query<{ id: string }>(`SELECT id::text FROM launch_weeks WHERE ends_at<=now() AND state IN ('scheduled','active') FOR UPDATE`);
    for (const week of weeks.rows) {
      await client.query(`WITH totals AS (
        SELECT pl.id,pl.product_id,pl.approved_at,count(lv.*) FILTER(WHERE lv.active)::int AS votes
          FROM product_launches pl LEFT JOIN launch_votes lv ON lv.launch_id=pl.id
         WHERE pl.launch_week_id=$1::uuid AND pl.state IN ('scheduled','active') GROUP BY pl.id
      ), ranked AS (
        SELECT id,votes,row_number() OVER(ORDER BY votes DESC,approved_at,product_id)::int AS position FROM totals
      ) UPDATE product_launches pl SET state='completed',final_rank=ranked.position,final_vote_count=ranked.votes
          FROM ranked WHERE pl.id=ranked.id`, [week.id]);
      await client.query(`UPDATE launch_weeks SET state='completed',completed_at=coalesce(completed_at,now()) WHERE id=$1::uuid`, [week.id]);
    }
    return weeks.rowCount;
  });
}

async function retryFailedWebhookReceipts(limit = 10) {
  const receipts = await query<{ webhook_id: string }>(`SELECT webhook_id FROM payment_webhook_receipts WHERE provider='dodo' AND (processing_status='failed' OR (processing_status='received' AND received_at<now()-interval '5 minutes')) AND attempts<8 ORDER BY received_at LIMIT $1`, [limit]);
  let processed = 0;
  for (const receipt of receipts) {
    try {
      const handled = await withTransaction(async (client) => {
        const locked = await client.query<{ payload: Record<string, unknown> }>(`SELECT payload FROM payment_webhook_receipts WHERE webhook_id=$1 AND (processing_status='failed' OR (processing_status='received' AND received_at<now()-interval '5 minutes')) AND attempts<8 FOR UPDATE SKIP LOCKED`, [receipt.webhook_id]);
        if (!locked.rows[0]) return false;
        const event = locked.rows[0].payload as Parameters<typeof processProDodoEvent>[1];
        const proOrderId = await proOrderForEvent(client, event);
        const outcome = proOrderId
          ? await processProDodoEvent(client, event)
          : event.type.startsWith("dispute.") ? "ignored" : await processDodoEvent(client, event as unknown as Parameters<typeof processDodoEvent>[1]);
        await client.query(`UPDATE payment_webhook_receipts SET processing_status=$2,attempts=attempts+1,processed_at=now(),last_error=NULL WHERE webhook_id=$1`, [receipt.webhook_id, outcome]);
        return true;
      });
      if (handled) processed += 1;
    } catch (error) { await query(`UPDATE payment_webhook_receipts SET processing_status='failed',attempts=attempts+1,last_error=$2 WHERE webhook_id=$1`, [receipt.webhook_id, error instanceof Error ? error.message.slice(0,500) : "retry failed"]); }
  }
  return processed;
}

async function releaseStaleJobLeases() {
  const rows = await query(`UPDATE notification_jobs SET state='failed',available_at=now(),last_error='worker lease expired',locked_at=NULL WHERE state='processing' AND locked_at<now()-interval '15 minutes' RETURNING id`);
  return rows.length;
}

async function retrySponsorRefunds(limit = 5) {
  if (!isDodoProviderConfigured()) return { sent: 0, failed: 0 };
  const jobs = await withTransaction(async (client) => {
    const claimed = await client.query<{ id: string; payload: { bookingId?: string; reason?: string } }>(`SELECT id::text,payload FROM notification_jobs WHERE job_type='sponsor_refund' AND state IN ('pending','failed') AND available_at<=now() AND attempts<8 ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT $1`, [limit]);
    for (const job of claimed.rows) await client.query(`UPDATE notification_jobs SET state='processing',locked_at=now(),attempts=attempts+1 WHERE id=$1::uuid`, [job.id]);
    return claimed.rows;
  });
  let sent = 0, failed = 0;
  for (const job of jobs) {
    try {
      const bookingId = job.payload.bookingId;
      if (!bookingId) throw new Error("missing booking id");
      const reason = typeof job.payload.reason === "string" && job.payload.reason.trim() ? job.payload.reason.trim().slice(0,1000) : "FounderTrail sponsorship refund";
      const bookings = await query<{ dodo_payment_id: string | null; payment_status: string }>(`SELECT dodo_payment_id,payment_status FROM sponsor_bookings WHERE id=$1::uuid`, [bookingId]);
      const booking = bookings[0];
      if (!booking || booking.payment_status === "refunded") { await query(`UPDATE notification_jobs SET state='sent',sent_at=now(),last_error=NULL WHERE id=$1::uuid`, [job.id]); sent += 1; continue; }
      if (!booking.dodo_payment_id) throw new Error("payment id unavailable");
      await query(`UPDATE sponsor_bookings SET payment_status='refund_pending',booking_status='refund_pending',refund_requested_at=coalesce(refund_requested_at,now()),updated_at=now() WHERE id=$1::uuid`, [bookingId]);
      const refund = await getDodoClient().refunds.create({ payment_id: booking.dodo_payment_id, reason, metadata: { foundertrail_booking_id: bookingId } }, { idempotencyKey: `foundertrail-refund-${bookingId}` });
      const succeeded = refund.status === "succeeded";
      await query(`UPDATE sponsor_bookings SET dodo_refund_id=$2,payment_status=$3,booking_status=$4,refunded_at=CASE WHEN $5 THEN now() ELSE refunded_at END,updated_at=now() WHERE id=$1::uuid`, [bookingId, refund.refund_id, succeeded ? "refunded" : "refund_pending", succeeded ? "refunded" : "refund_pending", succeeded]);
      await query(`UPDATE notification_jobs SET state=$2,available_at=CASE WHEN $2='sent' THEN available_at ELSE now()+interval '1 hour' END,sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END,last_error=NULL WHERE id=$1::uuid`, [job.id, succeeded ? "sent" : "failed"]);
      if (succeeded) sent += 1; else failed += 1;
    } catch (error) { failed += 1; await query(`UPDATE notification_jobs SET state='failed',available_at=now()+least(interval '24 hours',interval '15 minutes'*power(2,least(attempts,6))),last_error=$2 WHERE id=$1::uuid`, [job.id, error instanceof Error ? error.message.slice(0,500) : "refund failed"]); }
  }
  return { sent, failed };
}

async function reconcileExpiredDodoCheckouts(limit = 10) {
  if (!isDodoProviderConfigured()) return 0;
  const rows = await query<{ id: string; dodo_checkout_session_id: string }>(`SELECT id::text,dodo_checkout_session_id FROM sponsor_bookings WHERE booking_status='expired_hold' AND dodo_checkout_session_id IS NOT NULL AND dodo_payment_id IS NULL AND updated_at>=now()-interval '3 days' ORDER BY updated_at LIMIT $1`, [limit]);
  let reconciled = 0;
  for (const row of rows) {
    try {
      const session = await getDodoClient().checkoutSessions.retrieve(row.dodo_checkout_session_id);
      if (session.payment_id && session.payment_status === "succeeded") {
        const payment = await getDodoClient().payments.retrieve(session.payment_id);
        await withTransaction((client) => processDodoEvent(client, { type: "payment.succeeded", business_id: payment.business_id, timestamp: payment.updated_at ?? payment.created_at, data: payment }));
        reconciled += 1;
      }
    } catch { /* retried on the next bounded maintenance run */ }
  }
  return reconciled;
}

async function retryProRefunds(limit = 5) {
  if (!isDodoProviderConfigured()) return { sent: 0, failed: 0 };
  const jobs = await withTransaction(async (client) => {
    const claimed = await client.query<{ id: string; payload: { orderId?: string; reason?: string } }>(`SELECT id::text,payload FROM notification_jobs WHERE job_type='pro_refund' AND state IN ('pending','failed') AND available_at<=now() AND attempts<8 ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT $1`, [limit]);
    for (const job of claimed.rows) await client.query(`UPDATE notification_jobs SET state='processing',locked_at=now(),attempts=attempts+1 WHERE id=$1::uuid`, [job.id]);
    return claimed.rows;
  });
  let sent = 0, failed = 0;
  for (const job of jobs) {
    try {
      const orderId = job.payload.orderId;
      if (!orderId) throw new Error("missing order id");
      const orders = await query<{ dodo_payment_id: string | null; status: string }>(`SELECT dodo_payment_id,status FROM pro_launch_orders WHERE id=$1::uuid`, [orderId]);
      const order = orders[0];
      if (!order || order.status === "refunded") { await query(`UPDATE notification_jobs SET state='sent',sent_at=now(),last_error=NULL WHERE id=$1::uuid`, [job.id]); sent += 1; continue; }
      if (!order.dodo_payment_id) throw new Error("payment id unavailable");
      await query(`UPDATE pro_launch_orders SET status='refund_pending',updated_at=now() WHERE id=$1::uuid`, [orderId]);
      const priorRefunds = await query<{ dodo_refund_id: string; status: string }>(`SELECT dodo_refund_id,status FROM pro_refunds WHERE order_id=$1::uuid ORDER BY created_at DESC LIMIT 1`, [orderId]);
      const priorRefund = priorRefunds[0];
      const knownRefund = priorRefund ? await getDodoClient().refunds.retrieve(priorRefund.dodo_refund_id) : null;
      // Only a provider-confirmed failure permits a fresh refund attempt. Unknown
      // outcomes reuse the original idempotency key; pending refunds are polled.
      const refund = knownRefund && knownRefund.status !== "failed" ? knownRefund : await getDodoClient().refunds.create({
        payment_id: order.dodo_payment_id,
        reason: (job.payload.reason || "FounderTrail Pro payment conflict").slice(0, 1000),
        metadata: {
          foundertrail_pro_order_id: orderId,
          foundertrail_order_type: "pro_launch",
          foundertrail_environment: config.dodoPayments.environment,
        },
      }, { idempotencyKey: `foundertrail-pro-refund-${orderId}${knownRefund?.status === "failed" ? `-after-${knownRefund.refund_id}` : ""}` });
      await query(`INSERT INTO pro_refunds(order_id,dodo_refund_id,amount_minor,currency,status) SELECT id,$2,coalesce(paid_total_minor,quoted_price_minor),'USD',$3 FROM pro_launch_orders WHERE id=$1::uuid ON CONFLICT(dodo_refund_id) DO UPDATE SET status=CASE WHEN pro_refunds.status='succeeded' THEN 'succeeded' ELSE excluded.status END,updated_at=now()`, [orderId, refund.refund_id, refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "pending"]);
      if (refund.status === "succeeded") {
        await withTransaction((client) => processProDodoEvent(client, {
          type: "refund.succeeded",
          business_id: refund.business_id,
          timestamp: refund.created_at,
          data: refund as unknown as Record<string, unknown>,
        }));
      }
      await query(`UPDATE notification_jobs SET state=$2,available_at=CASE WHEN $2='sent' THEN available_at ELSE now()+interval '1 hour' END,sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END,last_error=NULL WHERE id=$1::uuid`, [job.id, refund.status === "succeeded" ? "sent" : "failed"]);
      if (refund.status === "succeeded") sent += 1; else failed += 1;
    } catch (error) {
      failed += 1; await query(`UPDATE notification_jobs SET state='failed',available_at=now()+least(interval '24 hours',interval '15 minutes'*power(2,least(attempts,6))),last_error=$2 WHERE id=$1::uuid`, [job.id, error instanceof Error ? error.message.slice(0,500) : "refund failed"]);
    }
  }
  return { sent, failed };
}

async function reconcileExpiredProCheckouts(limit = 10) {
  if (!isDodoProviderConfigured()) return 0;
  const rows = await query<{ id: string; dodo_checkout_session_id: string }>(`SELECT id::text,dodo_checkout_session_id FROM pro_launch_orders WHERE status IN ('checkout_created','processing') AND reservation_expires_at<=now() AND dodo_checkout_session_id IS NOT NULL ORDER BY reservation_expires_at LIMIT $1`, [limit]);
  let reconciled = 0;
  for (const row of rows) {
    try {
      const session = await getDodoClient().checkoutSessions.retrieve(row.dodo_checkout_session_id);
      if (session.payment_id && session.payment_status === "succeeded") {
        const payment = await getDodoClient().payments.retrieve(session.payment_id);
        await withTransaction((client) => processProDodoEvent(client, { type: "payment.succeeded", business_id: payment.business_id, timestamp: payment.updated_at ?? payment.created_at, data: payment as unknown as Record<string, unknown> }));
      } else if (session.payment_status !== "processing") {
        await query(`UPDATE pro_launch_orders SET status='cancelled',intro_slot=NULL,checkout_url=NULL,updated_at=now() WHERE id=$1::uuid AND status IN ('checkout_created','processing')`, [row.id]);
      }
      reconciled += 1;
    } catch { /* Provider uncertainty keeps the reservation; retry on the next run. */ }
  }
  return reconciled;
}

async function queueWeeklyDigests() {
  const week = new Date(); week.setUTCHours(0,0,0,0); week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7));
  const weekKey = week.toISOString().slice(0,10);
  const inserted = await query(`INSERT INTO notification_jobs(job_type,dedupe_key,payload)
    SELECT 'weekly_digest','weekly-digest:'||u.id||':'||$1,jsonb_build_object('userId',u.id,'week',$1::text)
      FROM app_users u WHERE u.digest_opted_in AND u.digest_unsubscribed_at IS NULL AND u.deleted_at IS NULL
        AND EXISTS(SELECT 1 FROM product_follows f JOIN product_updates pu ON pu.product_id=f.product_id WHERE f.user_id=u.id AND pu.status='published' AND pu.published_at>=now()-interval '7 days')
    ON CONFLICT(dedupe_key) DO NOTHING RETURNING id`, [weekKey]);
  return inserted.length;
}

async function sendWeeklyDigests(limit = 8) {
  if (!config.email.resendApiKey || !config.email.from) return { sent: 0, failed: 0 };
  const jobs = await withTransaction(async (client) => {
    const claimed = await client.query<{ id: string; dedupe_key: string; payload: { userId?: string; week?: string } }>(`SELECT id::text,dedupe_key,payload FROM notification_jobs WHERE job_type='weekly_digest' AND state IN ('pending','failed') AND available_at<=now() AND attempts<5 ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT $1`, [limit]);
    for (const job of claimed.rows) await client.query(`UPDATE notification_jobs SET state='processing',locked_at=now(),attempts=attempts+1 WHERE id=$1::uuid`, [job.id]);
    return claimed.rows;
  });
  let sent = 0, failed = 0;
  for (const job of jobs) {
    try {
      const userId = job.payload.userId;
      if (!userId) throw new Error("missing user");
      const users = await query<{ name: string; email: string; digest_opted_in: boolean; digest_unsubscribed_at: Date | null }>(`SELECT name,email,digest_opted_in,digest_unsubscribed_at FROM app_users WHERE id=$1 AND deleted_at IS NULL`, [userId]);
      const user = users[0];
      if (!user || !user.digest_opted_in || user.digest_unsubscribed_at) { await query(`UPDATE notification_jobs SET state='cancelled',last_error='preference disabled' WHERE id=$1::uuid`, [job.id]); continue; }
      const updates = await query<{ slug: string; product_name: string; title: string; body: string }>(`SELECT p.slug,p.name AS product_name,pu.title,pu.body FROM product_follows f JOIN products p ON p.id=f.product_id JOIN product_updates pu ON pu.product_id=p.id WHERE f.user_id=$1 AND p.status='published' AND pu.status='published' AND pu.published_at>=now()-interval '7 days' ORDER BY pu.published_at DESC LIMIT 20`, [userId]);
      if (!updates.length) { await query(`UPDATE notification_jobs SET state='cancelled',last_error='no eligible updates' WHERE id=$1::uuid`, [job.id]); continue; }
      const list = updates.map((update) => `<li style="margin:0 0 18px"><a href="${escapeHtml(`${config.siteUrl}/product/${update.slug}#updates`)}" style="font-weight:700;color:#182230">${escapeHtml(update.product_name)} — ${escapeHtml(update.title)}</a><br><span style="color:#667085">${escapeHtml(update.body.slice(0,240))}</span></li>`).join("");
      const unsubscribe = `${config.siteUrl}/digest-unsubscribe?token=${encodeURIComponent(digestUnsubscribeToken(userId))}`;
      const html = `<div style="max-width:620px;margin:auto;padding:32px;font-family:Arial,sans-serif;color:#182230"><h1>${brand.displayName} weekly updates</h1><p>Hi ${escapeHtml(user.name)}, here is one summary from products you chose to follow.</p><ul style="padding-left:20px">${list}</ul><p style="font-size:12px;color:#667085">Following does not subscribe you to other promotions. <a href="${escapeHtml(unsubscribe)}">Unsubscribe from this digest</a>.</p></div>`;
      const text = `Hi ${user.name},\n\n${updates.map((update) => `${update.product_name} — ${update.title}\n${update.body.slice(0,240)}\n${config.siteUrl}/product/${update.slug}#updates`).join("\n\n")}\n\nUnsubscribe: ${unsubscribe}`;
      const result = await new Resend(config.email.resendApiKey).emails.send({ from: emailFrom(), to: user.email, subject: `${brand.displayName}: updates from startups you follow`, html, text, headers: { "List-Unsubscribe": `<${unsubscribe}>` }, ...(config.email.replyTo ? { replyTo: config.email.replyTo } : {}) }, { idempotencyKey: job.dedupe_key });
      if (result.error || !result.data?.id) throw result.error ?? new Error("provider did not return an id");
      await query(`UPDATE notification_jobs SET state='sent',sent_at=now(),last_error=NULL WHERE id=$1::uuid`, [job.id]); sent += 1;
    } catch (error) { failed += 1; await query(`UPDATE notification_jobs SET state='failed',available_at=now()+least(interval '24 hours',interval '30 minutes'*power(2,least(attempts,5))),last_error=$2 WHERE id=$1::uuid`, [job.id, error instanceof Error ? error.message.slice(0,500) : "digest failed"]); }
  }
  return { sent, failed };
}

export async function runFounderTrailJobs() {
  const recoveredJobLeases = await releaseStaleJobLeases();
  const [bookingStates, launchArchives, webhookRetries, refundRetries, checkoutReconciliations, proRefunds, proCheckoutReconciliations, finalizedProReports, digestQueued] = await Promise.all([
    maintainBookingStates(), archiveLaunchWeeks(), retryFailedWebhookReceipts(), retrySponsorRefunds(), reconcileExpiredDodoCheckouts(), retryProRefunds(), reconcileExpiredProCheckouts(), finalizeDueProReports(), queueWeeklyDigests(),
  ]);
  const digests = await sendWeeklyDigests();
  return { recoveredJobLeases, bookingStates, launchArchives, webhookRetries, refundRetries, checkoutReconciliations, proRefunds, proCheckoutReconciliations, finalizedProReports, digestQueued, digests };
}
