# BidIndex implementation plan

## Phase 1 — Foundation and discovery

Dependencies: locked npm dependencies and an explicitly non-production PostgreSQL database for migration and seed verification.

- [x] Audit the repository, database, routes, ownership, analytics, clicks, and payment flow.
- [x] Define product scope, verification language, security boundaries, and payment-preservation rules.
- [x] Add additive, reversible BidIndex core migrations and a migration ledger.
- [x] Add an idempotent development-only demo seed.
- [x] Centralize branding and adapt the existing design system.
- [x] Build the header, homepage discovery list, filters, search, leaderboards, snapshot sidebar, and responsive layout.
- [ ] Run migration, lint, typecheck, tests, build, local route checks, and responsive visual checks. (Automated checks pass and static responsive checks are complete; database-backed runtime checks await a local `DATABASE_URL`.)

Acceptance criteria: organic discovery works from database data; demo values are labelled; payment does not affect ranking; required viewports have no horizontal overflow; phase checks pass or any missing local dependency is recorded precisely in `PASS.md`.

## Phase 2 — Product experience and ownership

Dependencies: Phase 1 product schema, query layer, branding, and responsive components.

- [x] Build product overview, media, live metrics, updates, integration summary, share, and weekly position.
- [x] Build validated pending submission and admin moderation.
- [x] Implement hashed owner links, product-scoped sessions, editing, and management views.
- [x] Implement local media storage, validation, gallery behavior, and fallbacks.
- [x] Implement unique upvotes and removal with abuse controls.
- [x] Implement founder updates.
- [x] Add safe BidIndex outbound redirects while retaining legacy redirects.
- [ ] Run migration, lint, typecheck, tests, build, local route checks, and responsive visual checks. (Code checks pass; database-backed end-to-end checks await a local database.)

Acceptance criteria: a pending product can be submitted and managed without leaking credentials; published product pages expose safe data; owners can edit, post updates, and see clicks; votes and redirects are unique and removable/countable as specified; phase checks pass.

## Phase 3 — Partner network and verification

Dependencies: Phase 2 ownership, published products, safe URL handling, metrics UI, and outbound tracking.

- [x] Add partner integration, verification, event, aggregate, and rate-limit migrations.
- [x] Build light, dark, and compact badge snippets.
- [x] Implement registered-origin public visitor events with deduplication and bot filtering.
- [x] Implement authenticated, idempotent server events with integer minor currency units.
- [x] Implement pinned HTTPS well-known domain verification and secret rotation.
- [x] Surface metric-specific sources and last-updated times.
- [x] Preserve and regression-test Lemon Squeezy infrastructure; keep promotions disabled.
- [x] Complete integration/environment documentation and final `PASS.md`.
- [ ] Run the full migration, lint, typecheck, test, build, local route, responsive, and embed QA suite. (Non-database checks pass; database-backed and live embed QA await a local database.)

Acceptance criteria: invalid origins/authentication/money/replays are rejected; accepted duplicates do not change aggregates; currencies remain separate; payment infrastructure passes regression tests; documentation and handoff are complete.
