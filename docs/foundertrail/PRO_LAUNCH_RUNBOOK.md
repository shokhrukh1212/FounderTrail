# FounderTrail Pro Launch runbook

This is the operator checklist for migration `016_pro_launch`, Dodo hosted checkout, Launch Studio, and seven-day reports. Run payment exercises in Dodo test mode and against an isolated database. Do not seed, migrate, charge, email, or deploy production while following the local checklist.

## Product and policy

Free keeps the approved startup page, normal launch scheduling, community activity, updates, approved media, ordinary links, and existing basic statistics. Pro is one one-time purchase per startup and adds Launch Studio plus one private seven-day results summary. It never buys placement, priority, votes, faster review, a launch date, or traffic.

The first 20 distinct qualifying live purchases cost USD 5 before tax; later purchases cost USD 9 before tax. A 24-hour local reservation can temporarily hold an introductory slot. Failed or abandoned reservations release safely after provider reconciliation. A paid introductory slot remains consumed after refund, admin revocation, restart, migration, or deploy. Refunds reduce net revenue and active-customer counts but never reopen the finite offer. A startup that already completed an introductory purchase cannot obtain another introductory slot. Test payments and complimentary admin grants use separate accounting and do not consume live slots.

## Dodo dashboard setup

Use the existing approved FounderTrail business. Test and live are separate environments; never mix a test API key, product, endpoint, or payment with live configuration.

1. In the Dodo Payments dashboard, select the correct business and environment.
2. Open **Settings → API Keys**, create/copy the environment's secret API key, and store it as `DODO_PAYMENTS_API_KEY` in the server secret manager.
3. Copy the selected business identifier into `DODO_PAYMENTS_BUSINESS_ID`. Confirm it equals the `business_id` on a retrieved sandbox payment before enabling checkout.
4. Create two distinct **one-time payment** products—not subscriptions, usage products, sponsorships, ads, or payment links:
   - `FounderTrail Pro Launch — Intro`: USD 5.00 (`500` minor units).
   - `FounderTrail Pro Launch — Standard`: USD 9.00 (`900` minor units).
5. Describe both accurately as a per-startup launch-tool purchase containing Launch Studio and a private seven-day results summary. Do not mention promotion, guaranteed traffic, ranking, votes, backlinks, or review speed.
6. Set the correct digital-service tax category. Keep both prices **tax-exclusive**: the configured $5/$9 is the pre-tax amount, and Dodo may add and report tax separately. Do not enable tax-inclusive pricing, pay-what-you-want, recurring billing, trials, or product-level discounting.
7. Open each product in the selected environment and copy its product ID into `DODO_PRO_INTRO_PRODUCT_ID` and `DODO_PRO_STANDARD_PRODUCT_ID`. Test and live need their own IDs.
8. Open **Developer → Webhooks → Add Webhook** and register exactly:

   ```text
   https://<canonical-production-domain>/api/webhooks/dodo
   ```

   Use the HTTPS deployment origin in `SITE_URL`; do not add a trailing slash. For a tunnelled local sandbox, register that tunnel's HTTPS origin with the same path.
9. Subscribe to `payment.succeeded`, `payment.processing`, `payment.failed`, `payment.cancelled`, `refund.succeeded`, `refund.failed`, and every available `dispute.*` event (`opened`, `challenged`, `won`, `cancelled`, `accepted`, `lost`, `expired`).
10. Copy that endpoint's **Secret Key** into `DODO_PAYMENTS_WEBHOOK_KEY`. It is endpoint- and environment-specific. Rotating it requires updating the application secret; Dodo documents a 24-hour overlap for the old key, but verify the new signature immediately.

Checkout sessions supply their own exact return and cancel URLs:

```text
https://<SITE_URL>/manage/<startup-slug>/pro?order=<internal-order-id>
https://<SITE_URL>/manage/<startup-slug>/pro?order=<internal-order-id>&cancelled=1
```

Nothing needs to be allowlisted as a global callback beyond the signed webhook. These browser URLs only display/poll status; they never activate Pro.

Required server values:

```dotenv
DODO_PAYMENTS_API_KEY=
DODO_PAYMENTS_WEBHOOK_KEY=
DODO_PAYMENTS_ENVIRONMENT=test_mode
DODO_PAYMENTS_BUSINESS_ID=
DODO_PRO_INTRO_PRODUCT_ID=
DODO_PRO_STANDARD_PRODUCT_ID=
PRO_LAUNCH_CHECKOUT_ENABLED=false
PRO_REPORT_EMAIL_ENABLED=false
```

The application disables checkout unless all required values exist and the feature flag is true. It also disables checkout currency selection and discount codes, requires quantity one, validates the environment/business/session/SKU/currency/pre-tax amount, rejects subscriptions, and activates access only from a verified signed event.

## Storage, fonts, exports, email, and scheduler

- Development can use `UPLOAD_STORAGE_DRIVER=local` and `UPLOAD_LOCAL_DIR=.data/uploads`. Production refuses local launch-kit uploads; configure the existing private S3-compatible bucket values. Private logo/screenshot objects are served only through owner-authorized routes and are not put under the public media prefix.
- The UI loads the bundled Geist variable font from the installed Next.js package. Canvas waits for `document.fonts.ready` and falls back to Arial/sans-serif. Keep the bundled font path covered by `npm run build` after framework upgrades.
- PNG export happens in the browser from the same canvas used for preview: landscape is exactly 1200×630 and square is exactly 1080×1080. No headless renderer or third-party asset host is required.
- Results can be printed or saved as PDF through the browser print dialog. The completed report snapshot is immutable.
- `PRO_REPORT_EMAIL_ENABLED` is reserved and defaults off; the current release does not send a report automatically. If a later email path is enabled, use the existing `RESEND_API_KEY`, verified `EMAIL_FROM`, and optional `EMAIL_REPLY_TO` without attaching private assets to logs.
- Call `GET /api/cron/tick` with `Authorization: Bearer <CRON_SECRET>`. Run it every 15–60 minutes for timely checkout/refund reconciliation and report finalization; the daily Vercel schedule is only a fallback. All work is bounded and idempotent. Alert on failed webhook receipts, failed jobs, held sessions older than 24 hours, and reports past `ends_at` that are not complete.

## Migration and preservation rehearsal

First create a native encrypted-at-rest database backup using your PostgreSQL provider's point-in-time snapshot/backup feature. Also make an operator-held dump to a restricted path and test restoring it. Do not put a dump in Git.

```bash
mkdir -p backups
chmod 700 backups
pg_dump "$DATABASE_URL" --format=custom --no-owner --file="backups/pre-pro-launch-$(date -u +%Y%m%dT%H%M%SZ).dump"
npm run foundertrail:baseline
```

The JSON backup command is available when a portable table-level inspection artifact is useful; it contains private data and must remain restricted:

```bash
npm run backup -- backups
chmod -R go-rwx backups
```

Set `TEST_DATABASE_URL` to a disposable database restored from the backup. Confirm its host/database name is not production, then run:

```bash
npm run foundertrail:baseline:test
npm run migrate:test
npm run foundertrail:reconcile:test
npm run migrate:test
npm run test:db
npm test
npm run lint
npm run typecheck
npm run build
```

The second migration run must apply nothing. Reconciliation must preserve every original product ID and the hashes/count floors for slugs, URLs, private contacts, owner credentials, historical votes, claims, launches, followers, comments, qualified listing views/clicks, media, and updates. Inspect `migration_reconciliation_runs` in `/admin/foundertrail`. Never run `migrate:down` on a database containing real Pro writes.

## Sandbox payment matrix

Keep `DODO_PAYMENTS_ENVIRONMENT=test_mode`. Enable `PRO_LAUNCH_CHECKOUT_ENABLED=true` only in the isolated sandbox deployment, then exercise:

- confirmed owner of an approved startup; anonymous, non-owner, unconfirmed, rejected, and missing startup;
- $5 checkout, quantity one, USD, tax-exclusive base amount, signed success, and access only after webhook processing;
- duplicate `webhook-id`, repeated success, reordered processing/success, failed and cancelled payments;
- two concurrent attempts for the last intro slot; exactly one holds it and the other must review/accept $9;
- all intro places held versus paid; the public count distinguishes reserved from completed;
- abandoned session expiry, provider lookup uncertainty, late success after a released hold, and the automatic conflict refund path;
- partial and full refunds, duplicate refund events, full-refund revocation, and no reopened intro allocation;
- dispute open/challenge suspension, win/cancel restoration, and accepted/lost/expired revocation;
- forged/mismatched business, environment, order metadata, session, payment, product, quantity, currency, amount, tax, and subscription fields;
- return/cancel URL visits before a webhook; neither may activate access;
- complimentary admin grant, revoke, and restore with required audit reasons; none affects purchase allocation or revenue.

Review `payment_webhook_receipts`, `pro_launch_orders`, `pro_refunds`, `pro_entitlements`, `pro_entitlement_events`, `notification_jobs`, and the admin page after each failure exercise. Provider payload storage is intentionally minimized; do not add customer/billing/card details to logs.

## Launch Studio and report verification

Use realistic sandbox startups and inspect the downloaded files, not only the DOM:

- open both PNG dimensions and verify their actual pixel size;
- test both templates, both themes, every accent, contain/crop and focal controls;
- test a long startup name/headline, non-Latin text, transparent logo, missing screenshot, broken/removed asset, and an overlong supporting line;
- verify the export either stays readable or shows an actionable fit/load error—never silent clipping, blank output, or important-word truncation;
- verify uploaded launch-kit assets are inaccessible to signed-out users and owners of another startup;
- verify draft autosave/version conflict behavior, reload, reset confirmation, copy, `.txt` download, and export telemetry;
- verify a future launch anchors the report, a pre-start reschedule follows it, and the window never restarts after tracking begins;
- verify seven half-open 24-hour slices, owner/admin/bot/duplicate filtering, net vote/follow changes, visible comments, incomplete-coverage disclosure, final snapshot immutability, and print/PDF layout.

Visually inspect `/`, `/pricing`, `/manage/<slug>/pro`, the pending and success states, `/manage/<slug>/launch-kit`, and `/manage/<slug>/results` at roughly 390, 768, and 1440 CSS pixels. Test keyboard focus, tooltip access, reduced motion, and a real mobile PNG download where the device/browser permits it. Save sanitized screenshots and sample exports outside public storage before launch approval.

## Sponsorship and Stripe retirement

- `/advertise` permanently redirects to `/pricing`.
- `POST /api/sponsor/bookings` returns `410 Gone`.
- New sponsored cards, homepage slots, startup-page sponsor cards, availability calendars, and promotion checkout are absent.
- Authorized legacy `/promote/<slug>` visits route to that startup's Pro page; a GET never activates access.
- `LEGACY_SPONSORSHIPS_ENABLED=false` is the normal setting. Preserve legacy signed webhook/refund reconciliation only while historical obligations require it.
- Every founder Stripe metrics method returns `410 Gone`, scheduled synchronization is removed, and no revenue/MRR claim appears publicly.

Before disabling any previously paid delivery in a real environment, query and review every non-demo sponsor booking whose paid service window or refund is unresolved. Preserve the record and choose documented grandfathered fulfillment or a full refund. Never silently discard a paid obligation.

## Live enablement and rollback

After the restored-database rehearsal, sandbox matrix, responsive/file inspection, and historical-obligation review all pass:

1. Take and restore-test the final production backup; record the privacy-safe baseline.
2. Apply pending migrations once during the approved window, then run reconciliation.
3. Deploy with `PRO_LAUNCH_CHECKOUT_ENABLED=false`; verify public Free behavior, Pricing, admin health, storage, cron, and signed webhook reachability.
4. In Dodo **live mode**, repeat the two-product and webhook setup with live IDs/keys. Set `DODO_PAYMENTS_ENVIRONMENT=live_mode` and the matching secrets atomically.
5. Perform one operator-approved low-value real purchase only if the launch owner explicitly authorizes it. Confirm receipt, entitlement, artifact export, report window, refund if planned, and accounting. A sandbox payment is not evidence of a live transaction.
6. Turn `PRO_LAUNCH_CHECKOUT_ENABLED=true` only after that sign-off. Monitor the first purchase and every intro allocation transition.

If checkout is unhealthy, set `PRO_LAUNCH_CHECKOUT_ENABLED=false`; existing entitlements, reports, drafts, records, and webhook reconciliation remain intact. Prefer a forward fix. Do not reverse migration `016` after it has accepted real orders or assets.

Provider references checked for the installed `dodopayments` SDK workflow on 22 September 2026: [hosted checkout sessions](https://docs.dodopayments.com/developer-resources/checkout-session), [webhooks and signatures](https://docs.dodopayments.com/developer-resources/webhooks), and [test mode](https://docs.dodopayments.com/miscellaneous/testing-process).
