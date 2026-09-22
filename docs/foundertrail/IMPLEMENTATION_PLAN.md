# FounderTrail implementation plan

This plan documents the previous FounderTrail phase. Sponsorship sales/displays and
Stripe revenue/MRR connections are retired in the Pro Launch release; see
[`PRO_LAUNCH_RUNBOOK.md`](PRO_LAUNCH_RUNBOOK.md) for the current implementation.

This is the execution plan produced from the repository audit. Implementation is organized so that schema addition precedes code activation and legacy identities remain stable.

## Sequence

1. Freeze and verify data: take a provider-native PostgreSQL backup, run `foundertrail:baseline`, and restore the backup into an isolated rehearsal database.
2. Rehearse migrations 001–012 using the checksum-aware runner. Validate that 011–012 preserve existing identities/history and reconcile the before/after baseline.
3. Configure the central FounderTrail brand and update active navigation, metadata, OG assets, email templates, About/guidelines, empty states, and legacy public redirects.
4. Add Better Auth accounts and attach ownership through new submissions, signed-in legacy-token exchange, domain-file proof, or audited administrator review.
5. Expose This week, Discover, Updates, product detail, follows, discussion, founder workspaces, update drafts/publishing, and one initial launch per approved product.
6. Add optional scoped Stripe metrics with encrypted restricted keys and explicit publication controls.
7. Add Dodo sponsor booking, 15-minute inventory holds, hosted checkout, signed/idempotent webhooks, refund/reconciliation jobs, qualified reporting, and admin controls.
8. Add durable weekly digest, launch archival, stale metric refresh, webhook/refund retry, and booking maintenance to the authenticated cron.
9. Verify security boundaries, responsive UI, empty/no-config/provider-error states, tests, lint, typecheck, build, and operational runbooks.
10. Deploy code with external features disabled, migrate production during a controlled window, perform smoke tests, then enable providers independently.

## Data model mapping

- Existing `products.id` remains the foreign-key root.
- `app_users`, `auth_sessions`, `auth_accounts`, and `auth_verifications` support accounts.
- `product_owners` and `product_claims` add account ownership without deleting `product_owner_credentials`.
- Product discovery adds nullable use-case, audience, pricing, price, currency, category relationships, and `created_by_user_id`.
- `launch_weeks`, `product_launches`, and `launch_votes` are isolated from legacy `product_votes`.
- `product_follows`, `product_comments`, and `content_reports` support community actions.
- Existing `product_updates` gains draft/published/archived lifecycle without changing published history.
- `metric_connections`, `metric_connection_scopes`, and `metric_snapshots` implement optional Stripe metrics.
- `sponsor_bookings`, `payment_webhook_receipts`, and `sponsor_events` implement Dodo sponsorship and qualified reporting.
- `notification_jobs` and `foundertrail_audit_events` provide durable work and operator evidence.

## Release boundaries

The implementation does not authorize a production migration, deployment, live purchase, refund, email, or role mutation. These remain explicit operator steps. `SPONSORSHIPS_ENABLED=false` is the safe initial state. Empty or incomplete provider configuration must render an unavailable state rather than a fake success path.

## Acceptance gates

- Production backup has a tested restore.
- Baseline reconcile reports no missing products, changed private-field hashes, or reduced historical counters.
- A new and an imported listing can both be claimed without replacing their IDs.
- Empty launch week still shows Discover results.
- Owner/non-owner/admin authorization tests pass for every write route.
- Launch vote uniqueness, undo, owner exclusion, week boundary, late join, and frozen result work.
- Dodo test checkout/webhook/refund validates the exact business, environment, product, currency, and base amount.
- Stripe test key proves restricted permissions, exact scope, multi-currency separation, refresh, publication opt-in, stale state, and purge on disconnect.
- No sensitive field appears in public responses or logs.
- `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` pass against a safe environment.
