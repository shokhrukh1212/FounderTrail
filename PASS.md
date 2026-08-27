# BidIndex handoff

## Current phase

Phase 3 — Partner network and verification. Implementation is complete; database-backed migration/runtime QA is pending because this workspace has no `DATABASE_URL` or PostgreSQL server.

## Completed work

- Audited the Next.js 16.3.2/React 19/raw PostgreSQL application, routes, schema, click tracking, environment names, and Lemon Squeezy flow before editing.
- Added three additive migrations with checksums and explicit development-only down migration support.
- Replaced the destructive seed with a repeatable `--confirm-demo` seed that deletes only `is_demo=true` BidIndex products and marks every synthetic value as demo data.
- Centralized BidIndex name, purpose, site URL, accent, and promotions flag in `lib/config.ts`.
- Built the discovery homepage, UTC filters, search, all-time and verified metric leaderboards, ecosystem snapshot, founder-update sidebar, responsive header, and About page.
- Built product profiles with overview, responsive media, local-time dates, weekly position, exact per-metric source/updated time, founder updates, share, vote, and tracked outbound action.
- Built pending submission with server validation, local development image adapter, owner-token hashing/fragment exchange, private management, edits, media add/replace/remove, founder updates, click counts, and admin moderation.
- Built unique removable votes with HTTP-only anonymous IDs, HMACed network fallback, database rate limits, and no raw IP storage.
- Kept `/r/[id]` legacy click tracking and added safe `/go/[slug]` BidIndex outbound tracking; neither accepts a caller-controlled destination.
- Built partner integration creation/rotation, light/dark/compact badge snippets, isolated tracked badge referrals, domain-verified exact-origin visitor events, bot/rate filtering, daily visitor dedupe, authenticated/idempotent server events, and per-currency integer-minor-unit aggregates.
- Built HTTPS well-known domain proof with public DNS screening, pinned address connection, TLS hostname validation, no redirects, response limit, and timeout.
- Preserved the Lemon Squeezy checkout, HMAC webhook verification, server-calculated amount validation, unique order idempotency, transactional settlement, environment names, and tests unchanged.
- Kept `FEATURE_PROMOTIONS=false`; no payment can affect organic discovery, votes, trends, or metric leaderboards.
- Completed the required product, plan, architecture, partner, README, and handoff documentation.

## Remaining work

Required once a developer supplies an explicitly local/non-production PostgreSQL database:

1. Copy `.env.example` to `.env.local`, fill `DATABASE_URL`, `EVENT_HASH_SALT`, and `ADMIN_ACCESS_SECRET`, then run `npm run migrate`.
2. Run `npm run seed:demo -- --confirm-demo` and verify exactly 12 visibly demo-labelled products.
3. Run `npm run dev` and exercise `/`, `/leaderboards`, `/submit`, `/product/yourhour`, `/manage/[slug]`, `/manage/[slug]/integration`, `/admin`, `/go/[slug]`, and `/from/[publicId]`.
4. Execute a vote add/remove, submission/moderation, owner edit/update/media cycle, badge event, duplicate visitor event, authenticated server event, duplicate server event, wrong-secret event, and secret rotation.
5. Repeat visual checks on the database-backed homepage/product/submit/manage routes at 1440, 1024, 390, and 375 pixels.

Production follow-ups, intentionally not faked in this workspace:

- Implement the documented production object-storage adapter before enabling uploads in production. The local adapter deliberately refuses production writes.
- Implement email/auth delivery of the one-time owner URL. Development shows it once; production intentionally does not return it in JSON.
- If paid promotions are later desired, add separate promotion records, fixed server pricing/duration, and webhook-only activation. The preserved legacy checkout must not be repurposed casually.

## Important decisions

- BidIndex organic tables and queries are isolated from `campaigns`, bids, checkout intents, and payment totals.
- Products begin `pending`; only an administrator with a signed HTTP-only session can publish them.
- Raw owner and integration secrets are never stored. Owner tokens travel once in a URL fragment; integration secrets are shown once after create/rotation.
- Browser pageviews require a verified domain and exact registered `Origin`. Revenue/bid/purchase events are server-only Bearer requests.
- Money remains integer minor units in its original currency. Currencies are never combined or converted.
- A domain proof does not verify individual metrics. Every aggregate keeps its own source.
- Badge referrals lead to the BidIndex profile and are stored separately from outbound-click metrics.
- Demo rows are excluded entirely in production, and demo votes cannot become production seed totals.

## Files created or changed

- Root/config: `.env.example`, `.gitignore`, `README.md`, `PASS.md`, `package.json`.
- Required docs: `docs/PRODUCT.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/PARTNER_INTEGRATION.md`.
- Migrations/scripts: `migrations/001_bidindex_core.{up,down}.sql`, `migrations/002_partner_network.{up,down}.sql`, `migrations/003_moderation.{up,down}.sql`, `scripts/migrate.ts`, `scripts/migrate-down.ts`, `scripts/seed-demo.ts`.
- Public UI: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/icon.svg`, `app/about/page.tsx`, `app/leaderboards/page.tsx`, `app/product/[slug]/page.tsx`, `app/submit/page.tsx`, `components/Logo.tsx`, `components/SiteHeader.tsx`, plus the new discovery, vote, time, share, and submission components.
- Ownership/moderation: `app/manage/**`, `app/admin/**`, `app/api/owner/**`, `app/api/admin/**`, and the new owner/admin components and helpers.
- Tracking/integrations: `app/go/**`, `app/from/**`, `app/embed/**`, `app/media/**`, `app/api/events/**`, `app/api/integrations/**`, `app/api/products/**`, and new BidIndex security/data/storage/integration libraries.
- Tests: `lib/__tests__/bidindex.test.ts`.

## Database migrations applied

None. No database environment is configured, no local PostgreSQL executable/server is available, and no production or external database was contacted.

Pending migrations, in order:

1. `001_bidindex_core.up.sql`
2. `002_partner_network.up.sql`
3. `003_moderation.up.sql`

## Commands run

- Repository audit: `git`, `rg`, `find`, and `sed` read-only inspections.
- Dependency install: `npm ci` from the lockfile.
- Baseline and iterative checks: `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
- Local server: `npm run dev`; `/about` returned HTTP 200.
- Responsive smoke screenshots: Playwright at 1440×1000, 1024×900, 390×844, and 375×812; all manually inspected.
- `git diff --check` and working-tree review.
- No deploy, push, remote branch, checkout transaction, webhook, production data change, or external service mutation occurred.

## Test and build status

- `npm test`: passes all 10 test files, including BidIndex vote uniqueness/removal contracts, trending ordering, redirect safety/counting contract, event idempotency, invalid integration auth, origin validation, integer money, submission validation, and existing payment tests.
- `npm run lint`: passes.
- `npm run typecheck`: passes after `next typegen`.
- `npm run build`: production compilation, TypeScript, static generation, and trace collection pass.
- Static visual smoke QA: passes at all four required widths on `/about`; no horizontal overflow observed.
- Database migration and dynamic-route end-to-end QA: not run for the precise missing-database reason above.

## Known issues

- Database-backed routes cannot render until the additive migrations are applied to a configured database.
- Production upload storage and production owner-link delivery are documented adapter points, not fake implementations.
- `FEATURE_PROMOTIONS` has no checkout flow and defaults false. This is intentional; the existing payment infrastructure was preserved rather than riskily adapted.
- Playwright’s screenshot helper injected a temporary caret-hiding input style, producing a development hydration warning; the screenshots rendered correctly and production build reports no hydration error.
- Direct legacy routes remain addressable for payment/in-flight compatibility but are absent from BidIndex navigation.

## Environment-variable names still required

Put local values in `.env.local`; put deployment values in the deployment provider’s encrypted server environment. Never prefix server secrets with `NEXT_PUBLIC_`.

- `DATABASE_URL`: obtain a non-production PostgreSQL connection URL from a local PostgreSQL instance or a dedicated development database. Required locally and in production.
- `SITE_URL`: the canonical origin, e.g. `http://localhost:3000` locally and the final HTTPS origin in production.
- `SITE_NAME`, `SITE_DESCRIPTION`, `SITE_ACCENT_COLOR`: product branding; safe defaults are already in `.env.example`.
- `EVENT_HASH_SALT`: generate at least 32 random bytes with a password/secret generator; required in production for vote, visitor, click, and rate-limit HMACs.
- `ADMIN_ACCESS_SECRET`: generate a separate high-entropy secret; used only for `/admin` session exchange.
- `FEATURE_PROMOTIONS`: leave `false` until a separate webhook-confirmed promotion model exists.
- `UPLOAD_STORAGE_DRIVER`, `UPLOAD_LOCAL_DIR`: use `local` and `.data/uploads` only for development.
- `ALLOW_LOCAL_PARTNER_ORIGINS`: leave `false`; set `true` only for a deliberate local browser-origin fixture.
- `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_BUCKET`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_BASE_URL`: obtain from the future chosen S3-compatible provider after implementing the production adapter; not required for local development.
- Existing payment variables `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`: retain their current deployment values; obtain from Lemon Squeezy API/store/webhook settings only for a new environment.
- Existing `CRON_SECRET`, `IP_HASH_SALT`, analytics, Meta, and X variables remain as documented in `.env.example` and are unchanged.

## Exact next task

Configure an explicitly non-production `DATABASE_URL`, run `npm run migrate`, inspect `schema_migrations` for all three checksums, run `npm run seed:demo -- --confirm-demo`, and execute the database-backed route/event checklist under **Remaining work**. Do not begin deployment or promotion work during that verification.

## Pre-existing changes to preserve

None. The starting branch was clean `main` tracking `origin/main`. All current uncommitted changes belong to this BidIndex implementation and must be preserved together.
