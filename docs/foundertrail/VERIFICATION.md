# FounderTrail verification

Use an isolated database restored from representative data. Provider checks belong in test/sandbox accounts. Record evidence without customer data or secrets.

## Automated checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Then run baseline/migration reconciliation as described in `MIGRATION_RUNBOOK.md`. Do not point these commands at production by accident.

## Data and migration

- Migration applies once under lock, records the expected checksum, and is a no-op on the second run.
- Every original `products.id` exists; slug/URL/contact/legacy-owner hashes match; legacy votes, qualified clicks, media, and updates do not decrease.
- No product is automatically enrolled in a launch.
- Historical bids/transactions remain queryable and clearly separated from launch votes/sponsorship.
- `POST /api/checkout` returns `410 Gone`; historical checkout status/webhook handling and `/r`, `/w`, and `/u` compatibility continue to work.

## Public product

- Navigation says FounderTrail and contains Discover, Updates, Submit startup, and account access—no platform bidding cross-promotion.
- This week includes only explicitly scheduled approved launches. With none, an honest empty state and real Discover list are both visible.
- Discover search/category/pricing/sort/pagination work. Unknown price says “See website.”
- Row name opens the detail page; Visit opens the destination; actions are not nested.
- Product page order is identity/use/pricing, media, updates, discussion, optional metrics, ownership claim, then history. Contacts/credentials/provider IDs are absent.
- Sponsor is one DOM node: desktop rail; after the first three organic rows on mobile; never in Updates; clearly labelled.
- Sitemap contains only public pages/products; private account/admin routes are noindex/disallowed.
- Check 360 px, tablet, and desktop without horizontal overflow; keyboard focus and reduced motion remain usable.

## Accounts and community

- Magic link is single-use/10-minute and rate limited. Optional Google linking cannot silently merge another account.
- Signed-out follow/vote/comment redirects to sign-in. CSRF/origin checks reject cross-site writes.
- Follow/unfollow is idempotent and does not imply promotional email consent.
- Comments support top-level plus one reply level, author edit, report, and reversible admin hide. Rate limits and duplicate report constraints work.
- Weekly digest is off by default, includes only followed product updates, dedupes by user/week, and supports one-click unsubscribe without a GET mutation.
- Account deletion refuses accounts still attached to managed products, revokes sessions/provider accounts, anonymizes identity, and retains required public contributions, moderation, payment, and audit history.

## Submission, claim, and moderation

- Save draft, verify domain, submit for review, approve or request changes with a founder-visible reason, resubmit, and recover a legacy listing without changing its product ID.
- Duplicate domain is detected before file upload. Existing public duplicate points to claim; private duplicate does not leak another founder’s details.
- Domain-file challenge is random, hashed at rest, expiring, one-time, HTTPS-only, and resistant to redirects/DNS-to-private-address SSRF.
- A legacy fragment proves ownership only after sign-in and account attachment; it does not authorize ongoing mutation.
- A competing claimant can verify domain control and open a dispute, but cannot replace the current owner; manual claim actions record reviewer/reason.
- Individual and selected-recipient claim invitations preview the real recipient, deduplicate email addresses, exclude already-owned products, and require explicit confirmation before dispatch.
- New domain/destination changes require re-verification/review. Manual claim actions record reviewer/reason.

## Launches and updates

- Launch week begins Monday 00:00 UTC and lasts seven days. Current-week late join copy shows the actual end and does not promise seven days.
- One initial launch per product is enforced. Only approved products schedule. Owner cannot vote for own launch.
- One active vote per account/launch is enforced by the database; undo works while active.
- Ordering is active votes descending, approval time, product ID. Cron freezes final vote count/rank after the boundary.
- Draft update is private; preview/edit/publish/archive work; ordinary update does not change launch dates.

## Stripe metrics

- Reject standard/secret/publishable keys; accept only a valid restricted read-only test key with every required read.
- Scope picker shows exact product IDs; account-wide requires explicit confirmation; overlapping account/product mapping is rejected.
- Revenue window, successful invoice-backed collection, partial refund allocation, currencies, recurring interval normalization, and MRR subscription states match the disclosed `stripe-v1` methodology.
- Publication is off until selected. Public card shows source/scope/currency/period/as-of/stale details. No conversion or currency combining occurs.
- Disconnect deletes secret, scopes, and snapshots. Logs/errors do not contain keys or customer/card/email data.

## Dodo sponsorship

- Two concurrent attempts for an overlapping interval produce one hold; adjacent `[end,start)` bookings are allowed.
- Hold expires after 15 minutes locally. Browser success/cancel cannot mark a booking paid.
- Signed test webhook validates event/business/environment/session/product/currency/base amount, is idempotent, and handles duplicates/out-of-order delivery.
- Paid placement begins exactly at UTC start and ends at start + 168 hours. It never changes launch order.
- Pre-start cancellation requests a full refund; active cancellation stops future display under the stated policy. Delivery conflict queues full refund.
- Impression requires 50%/one second/visible tab. Click shares the page-view ID. Reload/duplicate events and obvious bots do not inflate counts.
- Founder and admin reports match qualified database events. Creative/destination snapshots are immutable for a paid booking.

## Failure exercises

- Missing auth/email/Dodo/Stripe configuration shows unavailable guidance, not fake success.
- Dodo API timeout after hold, webhook retry, refund retry, expired checkout reconciliation, Stripe rate limit/pagination failure, stale snapshot, Resend failure, and cron retry leave durable inspectable state.
- Disable sponsorships and revoke test keys; public discovery and historical listings continue to work.
