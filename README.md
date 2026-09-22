# FounderTrail

FounderTrail is a startup discovery and progress platform. People can discover useful startups, follow what founders build next, vote in explicit weekly launches, and join product discussions. Founders can submit or claim a listing, publish updates, view basic qualified activity, and optionally buy Pro launch tools.

The application keeps existing BidIndex product identities, slugs, redirects, support totals, transactions, and audit history. Historical bidding data is clearly separated from FounderTrail launch ranking. New paid-ranking checkout is retired.

Start with the [Google/admin setup guide](docs/foundertrail/GOOGLE_AND_ADMIN_SETUP.md), [Pro Launch runbook](docs/foundertrail/PRO_LAUNCH_RUNBOOK.md), [content and product UI follow-up](docs/foundertrail/CONTENT_UI_FOLLOWUP.md), [setup guide](docs/foundertrail/SETUP.md), [migration runbook](docs/foundertrail/MIGRATION_RUNBOOK.md), and [verification checklist](docs/foundertrail/VERIFICATION.md).

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

FounderTrail Pro uses Dodo Payments hosted checkout. Keep `PRO_LAUNCH_CHECKOUT_ENABLED=false` until the complete Dodo test-mode checkout, signed-webhook, cancellation, dispute, refund, and late-payment lifecycle passes. New sponsorship sales and Stripe metric connections are hard-disabled; legacy payment handlers remain only for historical reconciliation.

## Deployment preparation

Do not run migration or deployment commands from an ordinary shell pointed at production. Follow the migration runbook: create and restore-test a native backup, capture the privacy-safe baseline, rehearse every pending migration through `016_pro_launch` in an isolated restore, reconcile the result, and only then schedule the production release. Keep checkout disabled until its provider-specific gates pass. Never run the demo seed against production.
