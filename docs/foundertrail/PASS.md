# FounderTrail handoff status

Last updated: 2026-09-21.

| Area | Status | Notes |
| --- | --- | --- |
| Repository/data audit | Implemented | `AUDIT.md` identifies real models, measurements, risks, and blockers. No production query was run. |
| Additive migrations 011–012 | Implemented; not database-tested | Account, ownership, launch, community, jobs, Stripe, Dodo, analytics, audit, claim-invitation, and reconciliation-result schema. Requires isolated restore rehearsal. |
| Migration safeguards | Implemented | Checksum runner, separate empty-DB bootstrap, privacy-safe baseline/reconcile tooling. |
| FounderTrail brand/navigation/SEO | Implemented; automated checks passed | Central brand, logo/favicon/OG, active copy, redirects, sitemap/robots. Existing product/history text is preserved. |
| Auth and account areas | Implemented; provider config required | Better Auth magic link; optional Google; My products, Following, Settings. No real email/OAuth test performed. |
| Ownership and claims | Implemented; DB/e2e pending | Account-only mutation, legacy proof exchange, domain-file challenge, competing-claim dispute review, manual admin review, audit, and explicit claim-invitation campaigns. |
| Submission/moderation | Implemented; DB/e2e pending | Draft/review/changes-requested/resubmission workflow, clear founder-facing reasons, duplicate-domain handling, owner attachment, expanded categories/pricing. |
| Discovery/product/community | Implemented; DB/e2e pending | This week/Discover/Updates, empty-week fallback, follows, discussion/reporting, history separation. |
| Weekly launches | Implemented; boundary/concurrency test pending | One launch, authenticated unique/undo vote, owner exclusion, stable/frozen ranking. |
| Founder updates/dashboard | Implemented; DB/e2e pending | Draft/preview/edit/publish/archive and measured activity summary. |
| Stripe metrics | Implemented; provider test required | Restricted-key validation, AES-GCM, scope exclusion, multi-currency snapshots, publication controls/purge. |
| Dodo sponsorship | Implemented; provider test required | Fixed USD 9 service, 168h slot, 15m hold, signed webhooks, conflict refund, reports/admin. |
| Durable jobs/digest | Implemented; provider test required | Booking/launch/webhook/refund/Stripe/digest jobs on authenticated cron. |
| Admin operations | Implemented; DB/e2e pending | Searchable ownership/launch/activity table, disputes, reports, launch scheduling, Dodo income/inventory/refunds, reconciliation/provider/job health, and explicit role bootstrap. |
| Responsive styling | Implemented; visual browser review pending | Single sponsor DOM and mobile placement, new account/community/admin layouts. |
| Legacy paid ranking | Retired | New checkout returns `410`; historical status, webhook, records, redirects, and tracking remain available. |
| Dependency security | Passed | Patched Next.js, Better Auth, Sharp, and js-yaml; full `npm audit` reports zero vulnerabilities. |
| Automated verification | Passed locally | Tests, lint, typecheck, production build, dependency audit, and diff whitespace check passed. |
| Production migration/deploy | Not completed | Intentionally outside this implementation session. |

## Final local verification results

- `npm test`: passed — 21 test files, 0 failures
- `npm run lint`: passed — no warnings or errors
- `npm run typecheck`: passed — Next route types and TypeScript
- `DATABASE_URL=postgresql://build:build@127.0.0.1:1/build npm run build`: passed on Next.js 16.3.5; the deliberately unreachable local database prevented accidental remote access
- `npm audit --audit-level=high`: passed — 0 vulnerabilities across production and development dependencies
- `git diff --check`: passed
- provider/database integration: not run; no isolated restored database or safe test-provider credentials were used

## Required operator next steps

1. Follow `MIGRATION_RUNBOOK.md` using a native backup restored into an isolated database.
2. Complete `VERIFICATION.md`, including concurrency and time-boundary checks.
3. Configure Resend and Better Auth; sign in; explicitly grant one administrator role.
4. Complete Dodo test-mode success, duplicate, delayed, cancellation, conflict, and refund paths before setting `SPONSORSHIPS_ENABLED=true` or `live_mode`.
5. Complete a Stripe test restricted-key scope/sync/disconnect lifecycle.
6. Deploy and migrate only after the release gates are signed off.
# FounderTrail final-fixes handoff

Last updated: September 22, 2026

## Completed

- Reworked the public discovery experience around launches, all-time community favourites, real product clicks, and permanent authenticated upvotes.
- Removed header search and directory "See website" badges. Product rows now use the primary Visit website action only.
- Added a canonical category taxonomy, owner/admin classification provenance, moderation review, and an evidence-based enrichment script. Public pricing shows a known label only when it is supported by the official site; otherwise it deliberately falls back to "See website" rather than inventing a price.
- Added clickable founder X handles with an X icon. Links open `x.com/<handle>` in a new tab with safe `rel` attributes.
- Replaced the visible sign-in flow with Google-only Better Auth and converted normal admin access to role-based Google accounts. The old secret path is isolated at `/admin/recovery` for emergency recovery only.
- Added Dodo-compatible sponsor configuration without showing a payment claim when the required configuration is absent.

## Data and migration status

- Applied migrations `013_permanent_upvotes_and_classification` and `014_classification_review_supersession` to the configured development database after taking a privacy-safe baseline.
- Reconciled all 113 original products after migration; product records, historical aggregate counts, and public records were retained.
- Official-site enrichment applied 34 high-confidence categories and 25 evidenced pricing labels. The remaining 75 category and 84 pricing items are explicitly queued for review rather than guessed.

## Verification

- `npm test`, `npm run typecheck`, `npm run lint`, and the production build pass.
- Desktop and 390px mobile browser smoke tests pass: no header-search control, no horizontal overflow, discovery content is visible without an excessive blank hero, and no client-console errors were observed.
- Anonymous upvote requests return 401 and route to Google sign-in; permanent voting is available only through the canonical product vote endpoint.

## Operator steps before production

1. Follow [Google and admin setup](GOOGLE_AND_ADMIN_SETUP.md) to add `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`, configure the exact production callback URL, and grant the first administrator role.
2. Add the Dodo environment values only after creating the matching product/checkout configuration. Until then, sponsor checkout is intentionally not advertised as active.
3. Use the FounderTrail admin classification queue to resolve remaining evidence-review entries. The enrichment command remains dry-run by default.

## Confirmed historical issues

- The apparent count discrepancy was caused by the old reporting/schema view omitting historical source tables, not by a deletion of products or votes. The migration reconciles those sources before exposing the permanent vote model.
- The old shared-secret admin proof was a separate cookie mechanism and did not grant a database user the `admin` role required by role-protected operations. Normal access now has one explicit, auditable Google-role path; emergency recovery is deliberately separate.
