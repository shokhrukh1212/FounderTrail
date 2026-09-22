# FounderTrail repository audit

Audit date: 2026-09-21. This document records the pre-migration system and the decisions used for the BidIndex-to-FounderTrail change. No production database was queried or mutated during this implementation session.

## Application and deployment

- Next.js 16.3.2 App Router, React 19, TypeScript, direct `pg` SQL, and Vercel deployment.
- The installed Next.js 16 route/auth/forms/metadata guidance in `node_modules/next/dist/docs/` was reviewed before changing those surfaces.
- `lib/db.ts` owns the shared PostgreSQL pool. There is no ORM.
- `scripts/migrate.ts` applies ordered `migrations/*.up.sql` files under a PostgreSQL advisory lock and records a SHA-256 checksum in `schema_migrations`.
- `lib/schema.sql` is a historical bootstrap/data-correction artifact. It is no longer run by normal migration. `scripts/bootstrap-db.ts` may run it only against an empty disposable database with `CONFIRM_EMPTY_DATABASE=true`.
- `vercel.json` invokes `GET /api/cron/tick` daily. The route requires `CRON_SECRET`; a more frequent external scheduler may invoke the same idempotent route.
- Uploads support local development or S3-compatible production storage. Resend handles email. Vemetric and ad pixels are optional existing analytics.

## Existing data that must remain authoritative

The stable product identity is `products.id`; slugs, URLs, contacts, moderation timestamps, media, source-labelled metric records, and historical counters must not be replaced. Core legacy tables include:

- `products`, `categories`, `product_categories`, `product_media`, and `product_submission_metadata`;
- `product_owner_credentials`, whose fragment token is retained only as one-time evidence to attach a modern account;
- `product_votes` and `product_vote_events`, which are historical BidIndex support and are not launch votes;
- `product_updates`, `product_outbound_click_events`, `product_listing_view_events`, `founder_referral_events`, and product integration/traffic tables;
- moderation, founder-email preference/campaign, suppression, webhook, visitor-day, and Vemetric-day records;
- historical checkout/campaign/accounting tables and Lemon Squeezy identifiers.

Existing bidding products remain legitimate product records. Their descriptions, old bids, transactions, audit evidence, and source data are not globally rewritten. Platform-owned marketing surfaces no longer present bidding or paid rank as the product.

## Measurement definitions

- A qualified profile view is an accepted `product_listing_view_events` row. Existing dedupe rules remain authoritative.
- A qualified outbound click is a counted `product_outbound_click_events` row; existing uniqueness and bot checks remain in place.
- `visitor_days` is one stored browser identifier per UTC day. Summing it is daily visitor entries, not an all-time count of unique people.
- Legacy `product_votes` are historical support. New `launch_votes` are authenticated, launch-specific, reversible while active, and unique by `(launch_id,user_id)`.
- A sponsor impression requires at least 50% visibility for one second in a visible document. Impression and click use the same browser-generated page-view UUID and are independently unique per booking/page-view/event type. Obvious bots are excluded.
- Stripe trailing-30-day revenue and current MRR are stored separately by currency. The page discloses scope, period, methodology, source, refresh time, and stale state. Values are never currency-converted or merged.

The screenshot values (108 products and 808 outbound clicks) are historical reference values only. They were not reasserted as live facts.

## Authentication, ownership, and permissions

- Better Auth provides magic-link sign-in and optional Google OAuth using the existing PostgreSQL database.
- Product publication status, ownership claim status, launch status, and metric-connection status are separate state machines.
- Existing owner fragments no longer authorize product mutations directly. After sign-in, a valid legacy credential can create an audited account ownership link.
- New and recovered ownership can use an expiring one-time domain-file challenge. Manual administrator review is available for disputes/lost access.
- Product manager routes require a current account owner/creator. Votes, follows, comments, and reports require an authenticated account. Product owners cannot vote for their own launch.
- Administrators may authenticate with an account whose `app_users.role` is `admin`. The signed legacy admin cookie remains as a compatibility bridge for existing moderation APIs.

## Payments and private integrations

- Dodo Payments is the only new sponsorship checkout adapter. The store is owner-approved, but test/live credentials and a fixed USD 9 sponsor product still require configuration and provider testing.
- Lemon Squeezy records/configuration are retained for historical or otherwise legitimate legacy functions and are not used for sponsorship advertising.
- Sponsorship inventory is one global `[start,end)` slot, exactly 168 hours, with a 15-minute local database hold. Only a validated signed Dodo payment can activate it. Late or conflicting success enters a durable refund path.
- Optional Stripe founder metrics use a founder-supplied restricted read-only key encrypted with AES-256-GCM. Keys never reach the browser after submission and are purged with snapshots on disconnect. Stripe is not the sponsorship merchant.

## Key risks and controls

| Risk | Control |
| --- | --- |
| Replaying historical schema/data fixes | Normal migration reads only numbered migration files; bootstrap is empty-DB gated. |
| Losing or changing existing products | Privacy-safe before/after fingerprints and nondecreasing historical counters. |
| Double booking | PostgreSQL exclusion constraint plus transactional slot hold; adjacent intervals are allowed. |
| Browser-trusted payment | Signed Dodo webhook and provider reconciliation only; success redirects do not activate inventory. |
| Webhook duplicates/reordering | Durable webhook receipt ID, idempotent transitions, and bounded retries. |
| Secret disclosure | Server-only config, AES-GCM key storage, no secret echo, minimal payment-event payload. |
| Metric overstatement | Explicit Stripe scope, separate currencies, displayed period/source/methodology, stale state. |
| Public private-data leak | Public queries exclude contacts, claim evidence, credentials, payment IDs, and audit details. |
| Irreversible moderation | Comments are hidden, reports dismissed/resolved, claims reviewed, and actions audited rather than silently deleted. |

## External blockers

- Migrations 011–012 have not been applied or rehearsed because the available `.env.local` points at a remote Neon database and no isolated test database was provided.
- No Dodo checkout, signed webhook, or refund was sent in test or live mode.
- No real Stripe restricted key was connected.
- No Resend magic link/digest was sent.
- Brand domain, support address, and social handle remain intentionally unset until the owner supplies them; the current canonical origin remains in use.
