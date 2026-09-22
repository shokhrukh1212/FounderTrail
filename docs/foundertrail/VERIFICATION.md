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
- Historical bids/transactions and sponsor records remain queryable and clearly separated from launch votes and Pro purchases.
- `POST /api/checkout` returns `410 Gone`; historical checkout status/webhook handling and `/r`, `/w`, and `/u` compatibility continue to work.

## Public product

- Navigation says FounderTrail and contains Pricing, Updates, Submit startup, and account access—no Advertise or platform bidding cross-promotion.
- This week includes only explicitly scheduled approved launches. With none, an honest empty state and real Discover list are both visible.
- Discover search/category/pricing/sort/pagination work. Unknown price says “See website.”
- Row name opens the detail page; Visit opens the destination; actions are not nested.
- Product page order is identity/use/pricing, media, updates, discussion, ownership claim, then history. Contacts/credentials/provider IDs are absent.
- No sponsor card, promoted row, advertising calendar, or sponsor checkout is exposed. Pro badges do not change organic order and are not labelled Verified.
- Sitemap contains only public pages/products; private account/admin routes are noindex/disallowed.
- Check 360 px, tablet, and desktop without horizontal overflow; keyboard focus and reduced motion remain usable.

## Accounts and community

- Google is the only public sign-in provider and cannot silently merge another account.
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

## Stripe retirement

- Every method on `/api/owner/products/<slug>/metrics/stripe` returns `410 Gone`.
- Owner navigation and public product pages have no revenue/MRR connection or claim.
- The scheduler does not refresh Stripe snapshots. Historical records are retained privately until an explicit separately reviewed removal migration exists.

## Dodo Pro Launch

- Two concurrent attempts for the twentieth intro allocation produce at most one slot; the other founder must explicitly accept $9.
- A local hold lasts 24 hours and provider uncertainty retains it for reconciliation. Browser success/cancel cannot mark an order paid.
- Signed test webhooks validate event/business/environment/session/payment/product/quantity/currency/pre-tax amount and subscription absence; `webhook-id` is idempotent.
- Test/demo/admin grants do not consume live intro allocation. Paid/refunded intro purchases do; a startup cannot reclaim another intro price.
- Partial refund retains access; full cumulative refund revokes it. Disputes suspend, restore, or revoke via explicit monotonic transitions.
- Launch Studio exports real 1200×630 and 1080×1080 PNGs from the preview canvas and keeps uploads private.
- Results use one future launch or activation anchor, seven half-open daily slices, filtered views/clicks, net votes/follows, visible comments, and an immutable final snapshot.

## Failure exercises

- Missing auth/email/Dodo/storage configuration shows unavailable guidance, not fake success.
- Dodo API timeout after a hold, webhook retry, refund retry, expired checkout reconciliation, broken asset, incomplete report coverage, Resend failure, and cron retry leave durable inspectable state.
- Disable Pro checkout and revoke test keys; public discovery, existing entitlements, and historical listings continue to work.

Use the complete payment, artifact, responsive, and production gates in [PRO_LAUNCH_RUNBOOK.md](PRO_LAUNCH_RUNBOOK.md).
