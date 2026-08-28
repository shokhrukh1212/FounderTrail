# BidIndex architecture

## Existing application and preserved payments

BidIndex remains the existing Next.js 16.3.2 App Router, React 19, strict TypeScript, Tailwind 4, and PostgreSQL/raw `pg` application. Server Components read through server-only modules; Route Handlers implement mutations, embeds, webhooks, and redirects. The local architecture and component system were extended rather than replaced.

The legacy Lemon Squeezy checkout, server-calculated amounts, webhook signature validation, provider-order idempotency, advisory-lock settlement, transaction tables, and environment variables remain intact. They are absent from BidIndex organic ranking and owner verification. Promotions remain disabled.

## Core data model

- `products` and `product_submission_metadata`: moderation lifecycle, approval/publication timestamps, approval-email delivery state, approved URL/domain, launch date, private submission contact, editable public copy, and extracted metadata.
- `product_owner_credentials`: random owner token hashes; raw tokens are deliberately shown only through the one-time private management-link flow.
- `product_media`, `product_updates`, `product_votes`: validated media, founder communication, and unique reversible community votes.
- `product_integrations`: public project ID, normalized allowed domain, domain/badge/product verification timestamps, visitor activity, and optional server-secret hash.
- `product_traffic_daily`, `product_daily_visitors`, `product_traffic_event_ids`, `product_referrer_daily`: pageview, approximate daily unique, badge impression/click, short-lived idempotency, and aggregate referrer data without raw IP storage.
- `product_metric_events`: idempotent authenticated event ledger using integer minor currency units.
- `product_metric_aggregates`: metric/source/currency totals, measurement period, source state, and update/receipt times.
- `product_public_evidence`: pending, accepted, rejected, stale, or archived administrator-reviewed public sources.
- `product_outbound_click_events` and `product_badge_referral_events`: separate BidIndex outbound and badge-referral accounting.

Migration `005_verification_metric_trust.up.sql` is additive. It preserves existing integrations and metric history, maps old source names to the explicit trust model, makes revenue secrets optional, and adds verification/traffic/source-state columns and indexes. Normal operation is forward-only; the down migration exists for disposable local recovery, not routine production rollback.

## Important routes

- `/manage/[slug]` — owner dashboard with Product, Updates, and Verification & data tabs.
- `POST /api/owner/products/[slug]/verify-domain` — checks the stored approved domain using meta or file verification.
- `POST /api/owner/products/[slug]/check-badge` — checks the stored approved page for the configured badge script and project ID.
- `POST /api/events/visitor` — origin-bound badge pageview/impression events.
- `POST /api/partner/v1/events` — authenticated, versioned server events. The legacy integration endpoint remains as a compatibility adapter.
- `/go/[slug]` — resolves only the approved product URL and records eligible BidIndex outbound clicks.
- `POST /api/admin/products/[slug]/owner-link` — admin-only, same-origin rotation for a lost owner link; returns the replacement once and stores only its hash.
- `PUT /api/admin/products/[slug]/status` — idempotently commits publication, then attempts the private approval email without rolling back publication on provider failure.
- `POST /api/admin/products/[slug]/approval-email` — admin-only safe retry for a failed/not-sent approval email.
- `POST /api/admin/approval-emails` — admin-confirmed, idempotent catch-up delivery for published non-demo products whose approval email was never sent.
- `GET /api/owner/products/[slug]` — authenticated, uncached owner status used for manual and 30-second pending polling; it returns no private contact data.
- `/from/[publicId]` — records badge clicks separately and routes to the BidIndex product page.
- `/admin` and `/api/admin/evidence/[id]` — submission and public-evidence moderation.

All generated badge, verification, and endpoint URLs use `SITE_URL`. No production domain is compiled into the implementation.

## Approval and owner-email access

Approval preserves the submission slug, writes `published` plus `approved_at`/`published_at` in one transaction, and records the moderation event. Public product, Newest, and UTC launch-date queries become eligible immediately because they already require the published status. Approval never inserts votes, traffic, metrics, revenue, or payment state.

After commit, Resend receives responsive HTML and plain text using the private contact email. The initial provider idempotency key is `product-approved:{productId}:{approvedAt}`; database delivery state prevents later duplicates, while failed attempts can safely retry the same deterministic payload. Provider failures are stored as sanitized codes and shown to administrators only.

The original raw owner token cannot be recovered from its hash. Approval email therefore carries a deterministic HMAC-signed access value in the URL fragment. A `beforeInteractive` scrubber moves that fragment into tab-scoped session storage and removes it from the address before analytics initialize; the owner access component immediately consumes and deletes it before POSTing it to the owner-session endpoint, which stores it only in the existing HTTP-only product cookie. The signature binds product ID, approval time, and credential version; administrator link rotation increments that version and invalidates both link forms. Resend click/open tracking must remain disabled for this transactional domain.

## Verification flow

```text
Owner proves stored domain ──> domain_verified_at
Owner installs badge ────────> badge_installed_at
Both present ────────────────> product_verified_at

Badge activity ──────────────> measured traffic (separate state)
Optional server events ──────> Partner connected metrics
Admin-reviewed public page ──> Publicly sourced metrics
Future official connector ───> Processor verified metrics
```

Low traffic does not remove product verification. Domain verification never marks a metric verified. Each metric retains its own source, period, currency, and update time.

## Traffic privacy and security

The badge is asynchronous and uses `sendBeacon` with a safe fetch fallback. It sends only a public project ID, random per-event ID, event type, and referrer hostname when available. It does not read host cookies/local storage, DOM content, forms, names, emails, payment details, full query strings, fragments, or keystrokes.

The event endpoint validates the request Origin against the verified allowed domain, filters obvious bots, rate-limits, and deduplicates event IDs. Approximate daily uniques use an HMAC of project ID, UTC date, a truncated server-observed network, and a coarse user-agent category. Raw IP addresses and full user agents never enter analytics tables; visitor hashes expire after their usefulness window.

Verification fetches derive targets from the stored product URL. In production they require HTTPS, reject credentials/private/reserved/loopback/link-local addresses, screen all DNS answers, pin the validated address while preserving TLS hostname verification, revalidate redirects, restrict redirects to the same normalized domain, cap redirects/bytes/time, accept expected content types, and forward no user cookies or application credentials.

Owner mutations require the product-scoped owner credential and same-origin requests. Admin mutations require the admin session. SQL is parameterized, React escapes founder copy, uploads reject SVG/HTML and validate MIME/magic bytes/size/dimensions, redirect routes never accept client destinations, and secrets are hashed at rest.

## Ranking and production visibility

All public product queries require `published`; production additionally requires `NOT is_demo`. Verified discovery uses `product_verified_at`. Trending remains weekly unique votes with eligible BidIndex clicks as tie-breaker. Revenue/visitor/click leaderboards exclude unavailable and founder-reported numbers, preserve original currencies, and show source labels. Payment tables are not read by organic ranking SQL.
