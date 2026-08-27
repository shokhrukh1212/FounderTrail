# BidIndex

BidIndex is the live, verified discovery platform for bidding products. This repository is an additive transformation of YourHour: the BidIndex discovery, ownership, voting, metrics, and partner-network tables are separate from the preserved legacy payment system.

Start with [the product brief](docs/PRODUCT.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), [architecture](docs/ARCHITECTURE.md), [partner guide](docs/PARTNER_INTEGRATION.md), and [current handoff](PASS.md).

## Preserved legacy payment model

- the first product bids $3
- bids are whole US dollars
- paying $1 more than a product beats that position
- the same domain maps to one listing
- an owner upgrading an existing listing pays only the difference
- rank is calculated when payment completes; checkout does not reserve a position
- completed bids are final and non-refundable
- outbound visits use `/r/{listingId}` and count once per eligible visitor per product

Legacy guaranteed-click payments are preserved in `leaderboard_migration_audits` before being rounded up to whole-dollar leaderboard totals. The old delivery columns remain temporarily for rollback but are no longer used by the application.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run migrate
npm run seed:demo -- --confirm-demo
npm run dev
```

The BidIndex public application does not expose legacy bidding in normal navigation. With Lemon Squeezy variables unset, the preserved legacy checkout uses the local completion stub. The configured Lemon Squeezy variant must accept custom prices as low as $1 because an owner can buy a one-dollar legacy upgrade. The webhook endpoint remains `/api/webhooks/lemonsqueezy`.

`/api/cron/tick` expires abandoned bid intents and retries durable analytics delivery. It does not promote campaigns, calculate capacity, or issue refunds.

## Production migration

Back up the database and briefly pause checkout before applying the schema:

```bash
npm run backup
npm run migrate
```

Verify the migration audit, normalized totals, original tie order, and click totals before resuming checkout. Do not remove the legacy delivery columns until the new model has been stable for at least seven days.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Before production launch, complete both a $3 new-listing checkout and a $1 existing-owner upgrade in the Lemon Squeezy test store.
