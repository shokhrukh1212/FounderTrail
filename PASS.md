# BidIndex handoff

## Current phase

Owner-management, verification/data simplification, approval publication/email/X sharing, final BidIndex brand refresh, and submission UX hardening — complete, migrated, locally tested, and production-build ready. Earlier BidIndex work was deployed; the approval-notification pass in this handoff was not deployed. No Git push was performed.

## Completed work

- Replaced the long owner form with responsive Product, Updates, and Verification & data tabs. Product editing now shows only name, one-line description, optional founder fields, read-only approved URL, logo, and up to four screenshots.
- Moved founder updates into their own compact tab and public evidence into a collapsed Verification & data section.
- Defined **Verified product** as confirmed domain ownership plus a detected BidIndex badge. Revenue and server events are explicitly optional and do not affect product verification.
- Added recommended meta-tag proof and alternate well-known-file proof, copy controls, retry/check controls, check times, clear failure messages, and SSRF-safe same-domain server retrieval.
- Rebuilt badge setup around a preview, Light/Dark/Compact selector, one environment-driven snippet, one copy action, installation check, and collapsed installation help.
- Added privacy-conscious badge traffic: asynchronous beacon/fetch reporting, no persistent cookies/fingerprinting, exact origin validation, bot/rate controls, event dedupe, daily approximate uniques, and separate badge-click tracking.
- Added `POST /api/partner/v1/events` with Bearer authentication, one-time/rotatable hashed server secrets, stable errors, integer minor units, uppercase currencies, refunds, idempotency, size/content checks, no accepted PII fields, and legacy endpoint compatibility.
- Standardized metric labels: Measured by BidIndex, Processor verified, Partner connected, Publicly sourced, Founder reported, and Unavailable.
- Kept payment infrastructure intact. Promotions remain disabled and organic queries do not read payment state.
- Added compatibility aggregation so temporary legacy/new metric source rows merge into a single public metric rather than producing duplicate cards during cutover.
- Corrected metadata titles so page titles are `Product · BidIndex` rather than duplicating the brand suffix.
- Centralized the approved BidIndex positioning and descriptions in `lib/brand.ts` so public brand copy can be changed from one location.
- Removed the homepage eyebrow entirely and updated the lead content to `Discover bidding products actually getting traction.` with the approved supporting description.
- Changed the homepage action hierarchy to primary `Explore products` and secondary `Submit your product — free`; Explore scrolls directly to the discovery list.
- Updated site, Open Graph, and Twitter metadata to `BidIndex — The Home of Bidding Products` with the approved description and the user-supplied 1200×630 `/og.jpg` asset.
- Removed the stale `Live bidding-product discovery` wording and redirected the legacy `/rules` page to the current submission guidelines rather than exposing old YourHour payment UI.
- Updated public-facing legacy placeholders, promotion labels, metadata fetch identity, About copy, footer copy, README, and product documentation. Internal legacy cookie/global identifiers remain only for backward compatibility.
- Updated the non-secret Vercel production `SITE_DESCRIPTION` value to the approved description.
- Deployed corrected Vercel production deployment `dpl_CpSPvxcQwh5NB5UBct1rSqujfTiw`, ready and aliased to `https://bidindex.dev`; live verification confirms the homepage has no eyebrow.
- Added the normal external `Bid live on YourHour ↗` link before Leaderboards on desktop and mobile navigation, preserving Submit product as the only coral action. Deployed production deployment `dpl_4kEMq21Hf8JAKvFwsDqav3XaUTRG`; live markup verified.
- Hardened product logos after diagnosing topwar.lol's published record: metadata was stored as manual with no media. Submission now re-fetches public metadata safely when the signed token is missing/invalid, accepts harmless `www` normalization, the same-origin logo proxy self-heals from the approved website, and display components try the site favicon before initials.
- Added admin-assisted owner-link recovery. After verifying the private contact email, moderation can generate a replacement link once; rotation increments the credential version, stores only the new hash, audits the action, and immediately invalidates the old link.
- Deployed these fixes as production deployment `dpl_y3PsQx3pbPoJPkM8tiQRBv4tbXur`. Live QA confirmed topwar.lol now renders `/api/products/topwar-lol-outbid-your-way-to-1-pay-to-r/logo`, which returns a valid 180×180 PNG, and the recovery endpoint returns 401 without an admin session.
- Replaced browser-only submission validation with explicit inline field errors. Missing/invalid website, name, description, launch date, private contact email, X handle, logo, screenshots, and consent now show a specific message beside the responsible input; the first invalid control is focused and smoothly centered instead of merely scrolling to the form.
- Added immediate logo/screenshot type, size, and count feedback; selected media is now submitted from controlled state so removing a preview truly removes the file from the payload. Server upload-count failures also return their exact field.
- Added accessible error relationships (`aria-invalid`, `aria-describedby`, live alerts), preserved entered values after validation failures, and verified the interaction without horizontal overflow at desktop and 375px.
- Deployed the submission UX as production deployment `dpl_CmUvKuN9gcEAzXiZBdVj8wZx4cxF`, ready and aliased to `https://bidindex.dev`; live browser QA passed at desktop and 375px.
- Made product approval idempotent and transactional: publication, the permanent slug, `approved_at`, `published_at`, category, and moderation event commit before any email is attempted. Approval creates no votes, metrics, visitor events, revenue, or payment records.
- Added persisted approval-email state and Resend delivery with HTML and plain-text bodies, product logo when available, canonical listing link, attributed X Web Intent, and a private signed management link. Provider failure leaves the product public and produces an administrator-only retry warning.
- Added a database-backed owner status experience: pending owners see `Pending review`, can check manually, and poll every 30 seconds; approved owners see the live banner plus Share on X and listing actions.
- Added one shared, word-safe X launch-copy builder for the owner dashboard, approval email, and public product page. Shared URLs use the canonical product path plus the specified founder-launch UTM parameters.
- Added signed fragment-based approval access. A pre-analytics scrubber moves the fragment into tab-scoped session storage and removes it from browser history before any analytics initialize; the owner component consumes and deletes it during exchange for the existing HTTP-only owner cookie. It is never included in public responses and is invalidated by owner credential rotation.
- Added administrator publication history, approval-email delivery status, copy/view actions, and safe manual resend. The existing shared-secret administrator model has no individual administrator identity to persist, so the approval moderation event is preserved without inventing an approver account.
- Fixed the owner media form's phone-width overflow and completed real-data browser QA at 1440px and 375px for owner, public product, X sharing, and administrator publication history.
- Diagnosed the production approval failure as a deployment/schema skew: migration 006 correctly required `approved_at`, while the previously deployed route only wrote `published_at`. The current idempotent route writes both timestamps in the publication transaction; its complete BrandMyPC approval path passed against production data inside an always-rolled-back diagnostic transaction. Unknown moderation failures now emit sanitized database code/constraint metadata without submission PII.
- Deployed the approval/schema-skew fix as production deployment `dpl_GdW771RrF1bAopqAjfCPeitEWCXq`, ready and aliased to `https://bidindex.dev`. BrandMyPC remains pending for the administrator to retry from the authenticated browser; the local admin secret intentionally did not match the encrypted production credential, so no credential was copied or exposed for automated mutation.
- Added an administrator-confirmed approval-email catch-up action after auditing production: 11 published non-demo products need notification (3 failed, 8 migration-skipped). The endpoint excludes demo and already-sent records, processes at most 25 sequentially per confirmation, and reuses the per-product approval idempotency key, so repeating it cannot intentionally duplicate delivery.
- Corrected the approval-email signature in both HTML and plain text from the mistaken `Shahzod` to `Shokhrukh Karimov`; the name is now defined once and covered by a regression assertion.
- Deployed the corrected signature and approval-email catch-up action as production deployment `dpl_9UM7kzonVJSuvq5L6EFERcSqXycH`, ready and aliased to `https://bidindex.dev`.
- Corrected product social metadata after live X inspection showed an SVG logo being advertised as a small summary card. Product pages now advertise the real 1200×630 `/og.jpg` JPEG as `summary_large_image`, publish their own canonical and `og:url`, and no longer inherit the homepage canonical.
- Deployed and live-verified the social-card fix as production deployment `dpl_6buRyiphuPyqZvhhQztGNbaRUWkj`; `/product/yourhour` now emits its product canonical plus `https://bidindex.dev/og.jpg` with JPEG type, 1200×630 dimensions, and `twitter:card=summary_large_image`.
- Rotated founder-share and OG-image cache keys with a harmless `share_version=2` query parameter so X re-scrapes the corrected card immediately; canonical URLs and the required analytics UTM values remain unchanged.
- Deployed and live-verified cache rotation as production deployment `dpl_65f7RH49Jxa6ijtQLMwzqwzgp5RK`; the Share on X intent and `og:image`/`twitter:image` now all carry the version-2 cache key.
- Updated the shared website/email X formatter: listing titles containing ` - ` or ` — ` use the short leading product name in the opening sentence, show the complete listing title as its own paragraph, then the one-line description and closing prompt. The 280-character budget still shortens only the description at a word boundary.

## Database migrations applied

- `001_bidindex_core.up.sql`, `002_partner_network.up.sql`, `003_moderation.up.sql`, `004_submission_simplification.up.sql` were already applied.
- `005_verification_metric_trust.up.sql` was first executed against the configured remote Neon schema inside an always-rolled-back transaction, then applied successfully with `npm run migrate` on 2026-08-28.
- `006_approval_notifications.up.sql` was applied successfully on 2026-08-28. It additively stores approval time and sanitized email delivery state; existing published products are marked `skipped` so migration never sends retroactive mail.

Migrations 005 and 006 are additive and forward-only in normal production use. They do not alter payment tables or insert demo/product records.

## Commands and verification

- `npm run migrate` — passed; migrations through 006 are applied and a repeat run is idempotent.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test` — passed: 16 test files, including approval publication/email/share/access contracts, submission field/upload UX validation, exact-brand/OG contracts, payment regression, submission, SSRF, demo visibility, source labels, verification, visitor privacy, event authentication/idempotency, money, and owner authorization contracts.
- `npm run build` — passed optimized production build.
- `git diff --check` — passed.
- Local production server QA — `/`, `/leaderboards`, `/about`, `/submit`, `/product/yourhour`, `/manage/yourhour`, and `/admin` returned 200 with no page error or horizontal overflow at 1440, 1024, 390, and 375 pixels. The final product page had one merged metric card and correct titles.
- Final local smoke check — `/` returned the exact approved title, description, headline, and CTA order with no eyebrow; `/og.jpg` returned `200 image/jpeg`; `/rules` returned a permanent redirect to `/about#submission-guidelines`.
- Vercel production build — passed on Next.js 16.3.2 and reached `READY`.
- Live production QA — `https://bidindex.dev/` returned the approved title, meta description, headline and CTAs; `https://bidindex.dev/og.jpg` returned `200 image/jpeg`; `/rules` returned `308` to the current submission guidelines.
- Submission UX browser QA — local and live `/submit` checks at 1440px and 375px confirmed at least five field-level messages, focus on the first invalid field, and no horizontal overflow.
- Approval browser QA — real local published data passed at 1440px and 375px: owner live state, no horizontal overflow, official X intent with attributed canonical URL, public-page share action, and admin publication history.

The unauthenticated management view was verified. Full owner-tab interaction requires the deliberate private owner token, which is not stored or recoverable from the database. Local admin submission through `127.0.0.1` was rejected by the intended same-origin protection because Next resolves the local host as `localhost`; use `http://localhost:3010/admin` for local admin interaction. This does not affect the configured production canonical origin.

## Important files

- `migrations/005_verification_metric_trust.up.sql`
- `migrations/006_approval_notifications.up.sql`, `lib/approval-email.ts`, `lib/approval-access.ts`, `lib/product-share.ts`
- `app/api/admin/products/[slug]/status/route.ts`, `app/api/admin/products/[slug]/approval-email/route.ts`, `components/ApprovalNotifications.tsx`, `components/XShareLink.tsx`
- `lib/product-verification.ts`, `lib/safe-fetch.ts`, `lib/partner-events.ts`, `lib/partner-maintenance.ts`, `lib/request-security.ts`, `lib/product-data.ts`, `lib/metric-format.ts`
- `components/OwnerDashboard.tsx`, `components/IntegrationManager.tsx`, `app/globals.css`
- `components/SubmissionForm.tsx`, `lib/submission-form-validation.ts`, `lib/__tests__/submission-form-validation.test.ts`, `app/api/products/route.ts`
- `lib/brand.ts`, `lib/__tests__/branding.test.ts`, `app/layout.tsx`, `app/page.tsx`, `app/about/page.tsx`, `app/rules/page.tsx`, `public/og.jpg`
- `app/api/owner/products/[slug]/{verify-domain,check-badge,integration}/route.ts`
- `app/api/events/visitor/route.ts`, `app/api/partner/v1/events/route.ts`, `app/embed/badge.js/route.ts`, `app/from/[publicId]/route.ts`
- `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/PARTNER_INTEGRATION.md`, `docs/PROCESSOR_CONNECTORS.md`, `docs/IMPLEMENTATION_PLAN.md`, `.env.example`, `README.md`

## Environment variables

`SITE_URL` remains the canonical environment-driven application origin; generated badge, verification, email, API, and share URLs use it. Approval mail adds these server-only values:

- `RESEND_API_KEY` — create in Resend Dashboard → API Keys after verifying the BidIndex sending domain.
- `EMAIL_FROM` — verified sender identity, recommended `BidIndex <notifications@bidindex.dev>`.
- `EMAIL_REPLY_TO` — optional monitored reply mailbox.

Keep Resend click/open tracking disabled for this transactional sender so private management links are not rewritten. None of these values may use a `NEXT_PUBLIC_` prefix.

Required server-only production values:

- `DATABASE_URL` — BidIndex PostgreSQL connection from Neon.
- `EVENT_HASH_SALT` — high-entropy server secret for event, visitor, and integration hashing.
- `IP_HASH_SALT` — retained legacy click/owner hash salt.
- `ADMIN_ACCESS_SECRET` — high-entropy moderation secret.
- `CRON_SECRET` — bearer secret for the cleanup cron if enabled.
- `STORAGE_S3_REGION`, `STORAGE_S3_BUCKET`, `STORAGE_S3_ACCESS_KEY_ID`, `STORAGE_S3_SECRET_ACCESS_KEY`, `STORAGE_S3_PUBLIC_BASE_URL` — production media storage credentials/configuration when `UPLOAD_STORAGE_DRIVER=s3`.
- Lemon Squeezy variables remain required only for preserved checkout: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET`.

Required public/safe configuration:

- `SITE_URL=https://YOUR_CANONICAL_DOMAIN`
- `FEATURE_PROMOTIONS=false`
- `UPLOAD_STORAGE_DRIVER=s3` in production
- `STORAGE_S3_ENDPOINT` and `STORAGE_S3_FORCE_PATH_STYLE` only when the object-storage provider requires them.

Keep `ALLOW_LOCAL_PARTNER_ORIGINS=false` in production. Only pixel/Vemetric identifiers with a `NEXT_PUBLIC_` prefix are intentionally client-visible.

## Remaining limitations

- A live official Stripe/Lemon Squeezy/Paddle founder connector is intentionally not implemented. Generic authenticated events are correctly labelled Partner connected. See `docs/PROCESSOR_CONNECTORS.md` for the secure future connector contract.
- Approval email cannot be exercised against Resend until its DNS records finish verification and `RESEND_API_KEY` and `EMAIL_FROM` are configured in Vercel. Publication safely succeeds without them and the administrator can retry afterward.
- The shared-secret administrator architecture cannot identify a named approving administrator. The existing moderation event records the transition; named attribution requires a future admin-account model.
- Existing production data was not reset or deleted in this pass. Demo visibility protections remain enforced.

## Exact next task

Verify the Resend sending domain, add `RESEND_API_KEY`, `EMAIL_FROM`, and optional `EMAIL_REPLY_TO` to the production environment, deploy the current tree, then submit one pending test product and approve it. Confirm publication remains immediate, exactly one approval email arrives, Share on X opens the attributed public URL, the email management link opens the owner dashboard, and retry does not duplicate delivery. Do not run the demo seed against production.

## Working tree note

This repository already contained the broader BidIndex transformation as uncommitted changes. Preserve the full dirty worktree; do not reset, discard, or selectively overwrite it. The user intentionally deleted the old `public/og.png` and `public/og2.png` assets and supplied `public/og.jpg`. No remote branch or Git push was created in this pass.
