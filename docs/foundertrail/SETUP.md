# FounderTrail setup

Copy `.env.example` into a private environment file and supply real values through the deployment secret manager. Never commit secrets.

## Core

- `SITE_URL`: existing canonical HTTPS origin, without a trailing slash.
- `SITE_NAME`: normally `FounderTrail`; the display name also has a central fallback in `lib/brand.ts`.
- `DATABASE_URL`: PostgreSQL connection. Use a distinct isolated database for rehearsal/tests.
- `AUTH_SECRET`: at least 32 random characters.
- `CRON_SECRET`, `EVENT_HASH_SALT`, `IP_HASH_SALT`: independent high-entropy values.
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`: required for the sole public sign-in provider. Follow `GOOGLE_AND_ADMIN_SETUP.md`.
- `RESEND_API_KEY` and `EMAIL_FROM`: optional for sign-in; required only for invitations, digests, and transactional email. Verify the sending domain first.
- production S3-compatible upload settings; local upload storage is refused in production.

After the first administrator has signed in, grant the role explicitly:

```bash
CONFIRM_ADMIN_ROLE=admin@example.com npm run foundertrail:set-admin -- admin@example.com --apply
```

Run the command without `--apply` first to preview the masked verified Google identity. The email must match exactly. The script changes one active account, invalidates its sessions, audits the change, and otherwise refuses to proceed. See `GOOGLE_AND_ADMIN_SETUP.md` for the complete sequence.

## Dodo Payments sponsorship

The approved Dodo store needs one product representing the actual service: one clearly labelled FounderTrail sponsored placement for 168 consecutive hours, USD 9 base price, no recurring billing, and no discount/coupon path.

Set `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_BUSINESS_ID`, `DODO_SPONSOR_PRODUCT_ID`, and `DODO_PAYMENTS_ENVIRONMENT=test_mode`. Keep `SPONSORSHIPS_ENABLED=false` until test verification passes. Register the exact webhook route:

```text
POST https://<current-domain>/api/webhooks/dodo
```

Subscribe to payment success/failure/cancellation and refund status events supported by the Dodo account. The handler verifies the raw signed payload, event ID, configured business/environment/product, USD currency, and USD 9 pre-tax base amount. Tax may be added by Dodo and is stored separately.

FounderTrail holds inventory locally for 15 minutes. Dodo hosted-session expiry is not treated as authoritative inventory. A provider-confirmed payment that arrives after the local hold or conflicts with another booking is not displayed; it enters the durable refund queue. Test success, duplicate delivery, delayed/reordered events, failed payment, cancellation, conflict/refund, and provider reconciliation before switching both the provider and app to live mode.

Lemon Squeezy must not be used or relabelled for sponsorship advertising. The old paid-ranking checkout now returns `410 Gone`; its status route and signed webhook remain only to reconcile historical orders. Retain old Lemon values only while that historical reconciliation is required.

## Optional Stripe founder metrics

Set `METRIC_ENCRYPTION_KEY` to exactly 32 random bytes encoded as base64 or 64 hex characters. A founder creates a Stripe restricted key beginning with `rk_test_` or `rk_live_` with read access only to Account, Products, Prices, Subscriptions, Invoices, and Charges. No write permission is needed.

The connection flow validates those reads before encryption/storage. A founder chooses exact Stripe product IDs or explicitly confirms account-wide scope, then separately opts in to publish trailing-30-day collected revenue and/or MRR. The same Stripe account/product scope cannot be attached to multiple FounderTrail products. Disconnect purges the encrypted key and all snapshots.

Stripe is not used for FounderTrail sponsorship checkout.

## Scheduler

Call `GET /api/cron/tick` with `Authorization: Bearer <CRON_SECRET>`. Daily Vercel cron is the minimum fallback; a trusted external scheduler every 15–60 minutes provides faster hold cleanup, refund/webhook retries, Stripe refresh, launch archival, and digest delivery. Jobs are idempotent and bounded, but monitor failures and latency.

## Administrator operations

- `/admin`: product moderation and private contact table.
- `/admin/foundertrail`: ownership claims, content reports, launch scheduling, sponsorship/refunds, metric/job/provider health.
- `/admin/founder-emails`: consent-aware founder campaign operations.
- Review new listings separately from ownership. A sponsor must already be an approved, managed listing.
- Manual claim decisions, content moderation, launch scheduling, and refund requests create audit records.
- Founder contacts, claim evidence, credentials, payment IDs, provider payloads, and audit detail are private and must not appear in public pages or exports.
