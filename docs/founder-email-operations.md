# Founder email operations

## Production configuration

Set `RESEND_WEBHOOK_SECRET`, `ADMIN_AUDIT_ACTOR`, and (optionally) `ADMIN_NOTIFICATION_EMAIL`. `EMAIL_FROM` must use a verified Resend domain and `EMAIL_REPLY_TO` should be a monitored inbox. FounderTrail keeps the configured mailbox but always normalizes the public sender display name, so an older deployment value such as `BidIndex <notifications@bidindex.dev>` is sent as `FounderTrail <notifications@bidindex.dev>`.

In Resend, send the bounce, complaint, delivered, failed, and suppressed events to:

`https://bidindex.dev/api/webhooks/resend`

Keep Resend click/open tracking disabled for transactional messages that contain management links. Campaign audit and delivery records intentionally store provider IDs and sanitized failure codes, not rendered content or private links.

## QStash schedule

Create one QStash schedule with:

- Destination: `https://bidindex.dev/api/cron/tick`
- Method: `POST`
- Cron: `*/5 * * * *`
- Header: `Authorization: Bearer <CRON_SECRET>`

The existing Vercel daily cron remains as a fallback. The maintenance endpoint is idempotent: it claims batches with database locks, uses stable provider idempotency keys, creates each milestone once, retries temporary delivery failures, and sends the verification reminder at most once after a successful delivery.

## Manual checks

- `/admin/founder-emails` — history, notifications, milestone and founding-banner settings
- `/admin/founder-emails/new` — templates, audience filters, previews, and test sends
- `/founding` — public founding-product collection
- `/email-preferences` — founder preference page (open using a private link from a campaign email)
- `/manage/{slug}` — owner growth summary, consent control, sharing, and optional verification
