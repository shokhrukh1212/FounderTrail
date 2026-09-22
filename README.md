# FounderTrail

FounderTrail is a startup discovery and progress platform. People can discover useful startups, follow what founders build next, vote in explicit weekly launches, and join product discussions. Founders can submit or claim a listing, publish updates, view qualified activity, and optionally connect read-only Stripe metrics.

The application keeps existing BidIndex product identities, slugs, redirects, support totals, transactions, and audit history. Historical bidding data is clearly separated from FounderTrail launch ranking. New paid-ranking checkout is retired.

Start with the [Google/admin setup guide](docs/foundertrail/GOOGLE_AND_ADMIN_SETUP.md), [FounderTrail audit](docs/foundertrail/AUDIT.md), [implementation plan](docs/foundertrail/IMPLEMENTATION_PLAN.md), [setup guide](docs/foundertrail/SETUP.md), [migration runbook](docs/foundertrail/MIGRATION_RUNBOOK.md), [verification checklist](docs/foundertrail/VERIFICATION.md), and [current handoff](docs/foundertrail/PASS.md).

## Local setup

```bash
npm install
cp .env.example .env.local
npm run migrate
npm run dev
```

To add explicit synthetic development fixtures to a disposable non-production database:

```bash
npm run seed:demo -- --confirm-demo
```

Production never returns demo records even if they exist in the database. Migrations never insert demo products.

Google is the only public sign-in provider. Set `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET` as documented in the [exact setup guide](docs/foundertrail/GOOGLE_AND_ADMIN_SETUP.md). Resend remains separate and is used only for transactional email, invitations, digests, and optional founder campaigns; missing email configuration does not disable Google sign-in or public discovery.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

FounderTrail sponsorship uses Dodo Payments only. Keep `SPONSORSHIPS_ENABLED=false` until the complete Dodo test-mode checkout, signed-webhook, conflict, cancellation, and refund lifecycle passes. The legacy Lemon Squeezy webhook and status route remain only to reconcile historical orders; `POST /api/checkout` returns `410 Gone` and cannot create a new paid-ranking order.

## Deployment preparation

Do not run migration or deployment commands from an ordinary shell pointed at production. Follow the migration runbook: create and restore-test a native backup, capture the privacy-safe baseline, rehearse migrations 011–012 in an isolated restore, reconcile the result, and only then schedule the production release. Keep external features disabled until their provider-specific test gates pass. Never run the demo seed against production.
