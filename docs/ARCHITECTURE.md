# BidIndex architecture

## Existing application

The repository is a Next.js 16.3.2 App Router application using React 19, strict TypeScript, Tailwind 4, raw `pg`, and PostgreSQL. Server Components read the database directly and Route Handlers expose JSON, webhook, and redirect endpoints.

YourHour payment infrastructure consists of `campaigns`, `checkout_intents`, payment/accounting audit tables, Lemon Squeezy checkout creation, an HMAC-verified webhook, server-calculated amounts, a unique provider order ID, transactional settlement under a PostgreSQL advisory lock, and a development-only completion stub. The analytics ledger forwards durable events to Vemetric and X. This infrastructure remains intact.

The legacy `/r/[id]` route records a deduplicated campaign click using an anonymous UUID cookie, hashed network address, bot and owner filtering, and database rate checks. BidIndex reuses those patterns but stores product activity separately.

## New model

- `products`, `categories`, and `product_categories` hold moderated discovery content.
- `product_owner_credentials` holds only hashes of random owner tokens.
- `product_media` stores validated adapter keys and public metadata.
- `product_votes` stores one mutable active vote per product and hashed visitor.
- `product_updates` stores plain-text founder announcements.
- `product_outbound_click_events` stores counted and excluded redirect attempts without raw IP addresses.
- `product_metric_aggregates` stores database-backed values with an exact source and optional currency.
- `product_integrations`, `product_metric_events`, `product_badge_referral_events`, and `domain_verification_attempts` support the partner network.
- `api_rate_limit_events` provides shared database-backed request limiting.

New tables are introduced by checksummed `up` migrations with companion `down` files. The historical `lib/schema.sql` stays as the legacy bootstrap and is not rewritten.

## Routes and flow

Public discovery uses `/`, `/leaderboards`, `/about`, `/submit`, and `/product/[slug]`. Server Components query a server-only data layer rather than making HTTP requests back into the application.

Submission creates a pending product and a hashed owner credential. A local-only one-time URL carries the raw token in a fragment; a POST exchange sets a product-scoped HTTP-only cookie and removes the fragment from history. Owner and admin authorization is repeated inside every mutation.

`/go/[slug]` resolves only a stored product URL, records the attempt, and redirects even if counting fails. No redirect endpoint accepts a destination URL from the caller.

The partner badge script sends a domain-verified, origin-validated pageview without page content. Server revenue, purchase, and bid events use a Bearer secret, unique event ID, timestamp bounds, integer minor units, and transactionally updated per-currency aggregates. Badge referral tracking leads to the BidIndex profile and is isolated from `/go/[slug]` outbound click accounting.

## Ranking

- Today uses the effective launch timestamp inside the current UTC day.
- Trending uses active unique votes first created in the rolling previous seven days, with counted BidIndex outbound clicks from the same period as tie-breaker.
- Newest uses publication time descending.
- Verified requires at least one technically verified metric.
- Most upvoted uses all-time active unique votes.
- Metric leaderboards accept only technically verified or publicly sourced values and never combine currencies.

Stable publication time and ID tie-breakers follow the documented criteria. Legacy bids and all payment fields are absent from organic queries.

## Security decisions

All SQL is parameterized. User content remains plain text and React-escaped. Mutation endpoints validate content type, body size, client input, authorization, and same-origin requests where applicable. Remote HTML verification uses DNS resolution, private-address rejection, pinned connections, redirect validation, byte limits, and timeouts. Media uses server-generated names and magic-byte validation. Raw IP addresses, owner tokens, and integration secrets are never stored or logged.

## Payment preservation

The current Lemon Squeezy integration, webhook signature verification, amount validation, order idempotency, checkout tables, environment variables, analytics delivery, and legacy routes remain available for regression and in-flight compatibility. BidIndex public navigation does not expose the old bidding UI. Promotions remain disabled; a future promotion flow requires its own records, fixed price/duration, webhook-only activation, and explicitly labelled rendering outside every organic query.
