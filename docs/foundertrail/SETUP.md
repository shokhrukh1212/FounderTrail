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

For local rehearsal, set `TEST_DATABASE_URL` in `.env.local` to an isolated PostgreSQL database, run `npm run migrate:test`, then `npm run dev:test`. The development command checks connectivity and migration `020` before starting Next.js. It never falls back to `DATABASE_URL` or applies migrations automatically. See [local test setup](../../README.md#local-test-database).

After the first administrator has signed in, grant the role explicitly:

```bash
CONFIRM_ADMIN_ROLE=admin@example.com npm run foundertrail:set-admin -- admin@example.com --apply
```

Run the command without `--apply` first to preview the masked verified Google identity. The email must match exactly. The script changes one active account, invalidates its sessions, audits the change, and otherwise refuses to proceed. See `GOOGLE_AND_ADMIN_SETUP.md` for the complete sequence.

## Dodo Payments Pro Launch

Follow [PRO_LAUNCH_RUNBOOK.md](PRO_LAUNCH_RUNBOOK.md). Pro uses two separate one-time USD products: $5 introductory and $9 standard, both before tax. Configure `DODO_PRO_INTRO_PRODUCT_ID`, `DODO_PRO_STANDARD_PRODUCT_ID`, the matching environment credentials, and the signed webhook. Keep `PRO_LAUNCH_CHECKOUT_ENABLED=false` until every sandbox gate passes.

New sponsorship sales and public placements remain disabled. Stripe revenue/MRR connection endpoints are also retired in this release. Keep legacy records and secrets only as long as historical reconciliation or refund obligations require them.

## Scheduler

Call `GET /api/cron/tick` with `Authorization: Bearer <CRON_SECRET>`. Daily Vercel cron is the minimum fallback; a trusted external scheduler every 15–60 minutes provides faster checkout reconciliation, refund/webhook retries, report finalization, launch archival, and digest delivery. Jobs are idempotent and bounded, but monitor failures and latency.

## Administrator operations

- `/admin`: product moderation and private contact table.
- `/admin/foundertrail`: ownership claims, content reports, launch scheduling, Pro grants/revocation/refunds, allocation, income, report states, and provider/job health.
- `/admin/founder-emails`: consent-aware founder campaign operations.
- Valid new submissions publish and gain listing management immediately. Moderate abuse after publication; Pro purchases require authorized management access. Follow [INSTANT_LAUNCH_RUNBOOK.md](INSTANT_LAUNCH_RUNBOOK.md) for legacy access/status migration.
- Manual claim decisions, content moderation, launch scheduling, Pro entitlement actions, and refund requests create audit records.
- Founder contacts, claim evidence, credentials, payment IDs, provider payloads, and audit detail are private and must not appear in public pages or exports.
