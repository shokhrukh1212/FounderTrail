# BidIndex

BidIndex is the discovery platform for bidding products. Discovery, submission, ownership, voting, metrics, evidence, and partner-network records remain isolated from the preserved legacy payment infrastructure.

Read [the product brief](docs/PRODUCT.md), [three-phase plan](docs/IMPLEMENTATION_PLAN.md), [architecture](docs/ARCHITECTURE.md), [partner guide](docs/PARTNER_INTEGRATION.md), [future processor connector rules](docs/PROCESSOR_CONNECTORS.md), and [current handoff](PASS.md).

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

Approval email uses Resend after the publication transaction commits. Set the server-only `RESEND_API_KEY` and `EMAIL_FROM` values after verifying the sending domain; `EMAIL_REPLY_TO` is optional and must be a monitored inbox. Keep Resend click/open tracking disabled so private management-link fragments are not rewritten. Missing email configuration never prevents an administrator from publishing a product.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

The Lemon Squeezy webhook remains `/api/webhooks/lemonsqueezy`. Checkout amounts are server-calculated, completed provider order IDs are idempotent, and payment state never affects BidIndex organic ranking. `FEATURE_PROMOTIONS` must remain `false` until a separate webhook-confirmed promotion model is implemented.

## Deployment preparation

1. Back up the target database.
2. Configure the production variables listed in `PASS.md` in the deployment provider—never in a committed file.
3. Run `npm run migrate` against the intended database.
4. Run the verification commands above.
5. Preview locally with `npm start` or create a provider preview deployment.

Recommended production deployment command after those checks:

```bash
npx vercel deploy --prod
```

Do not run the demo seed against production.
