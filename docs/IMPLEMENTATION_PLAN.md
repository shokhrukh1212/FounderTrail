# BidIndex implementation plan

## Phase 1 — Foundation and discovery

Dependencies: existing Next.js/PostgreSQL application and an explicitly non-production database.

- [x] Audit repository, schema, environment, routes, clicks, ownership, analytics, and Lemon Squeezy flow.
- [x] Add checksummed forward migrations, explicit development seed, central branding, and promotion flag.
- [x] Build responsive discovery, the exact four tabs, accurate snapshot, zero states, search/query layer, and leaderboards.
- [x] Remove Search and Discover from the public header while retaining isolated search support.
- [x] Exclude pending and demo records from every production public surface and action.
- [x] Run migration, lint, typecheck, tests, build, production zero-state QA, and 1440/1024/390/375 responsive checks.

Acceptance: production renders only approved non-demo records; organic ranking never reads payment state; each empty view is intentional and mobile pages do not overflow. **Accepted.**

## Phase 2 — Product experience and ownership

Dependencies: Phase 1 schema, data layer, and responsive design.

- [x] Keep the four product tabs and render only overview fields that exist.
- [x] Replace the wizard with URL-first metadata extraction and one editable review form.
- [x] Require private contact email and consent; make founder fields/media optional; remove categories and legacy commercial fields from initial validation/payload.
- [x] Preserve hashed owner links, management, updates, media, votes, and tracked outbound redirects.
- [x] Replace the long owner form with Product, Updates, and Verification & data tabs; keep the approved URL read-only and infer media type from the chosen upload action.
- [x] Add one-time copyable management-link success screen and approval-only integration access.
- [x] Expand moderation with private submission metadata, duplicate warning/override, edit, one category, approve, and reasoned reject.
- [x] Run validation, ownership/privacy contracts, responsive route QA, tests, and build.

Acceptance: manual submission works if extraction fails; every new product is pending; private email and raw token never enter public DTOs; approval creates no vote or metric. **Accepted.**

## Phase 3 — Partner network and verification

Dependencies: Phase 2 ownership and approved products.

- [x] Define Verified product as confirmed domain plus detected badge; keep visitor activity and optional revenue state separate.
- [x] Add meta-tag and well-known-file proof with pinned same-domain HTTPS checks, retry status, copy actions, and explicit last-check times.
- [x] Replace three badge snippets with preview, style selector, one copyable snippet, installation detection, and collapsed help.
- [x] Make traffic privacy-conscious and ephemeral; retain origin validation, bot/rate controls, daily approximate uniques, and separate badge/outbound click accounting.
- [x] Add `/api/partner/v1/events` with optional one-time secret creation/rotation, authenticated/idempotent integer-money events, refund handling, currency separation, and compatibility routing.
- [x] Standardize Measured by BidIndex, Processor verified, Partner connected, Publicly sourced, Founder reported, and Unavailable terminology.
- [x] Add owner-submitted public evidence with pending/accepted/rejected moderation separate from live verification.
- [x] Add S3-compatible production media storage while retaining local development storage and magic-byte/dimension validation.
- [x] Add metadata SSRF defenses, redirect revalidation, DNS pinning, time/size/type limits, security headers, and product sharing metadata.
- [x] Preserve payment checkout/webhooks/tests and keep promotions disabled.
- [x] Complete migration, tests, lint, typecheck, production build, local production server, browser QA, documentation, and handoff.

Acceptance: no browser can report revenue; replayed events do not aggregate; currencies remain separate; public evidence needs admin action; payment infrastructure is unchanged and regression-tested. **Accepted.**

## Post-MVP approval notification pass

- [x] Define idempotent publication and approval-email state without changing organic ranking.
- [x] Add pending owner polling and database-backed live status.
- [x] Add canonical attributed X sharing to owner, email, and public product surfaces.
- [x] Add signed fragment-based approval access while preserving the original hashed owner token.
- [x] Add Resend HTML/plain-text delivery after commit plus safe administrator retry.
- [x] Apply migration 006 and complete full automated/browser verification.
