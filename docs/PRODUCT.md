# FounderTrail product brief

## Purpose

FounderTrail helps people find useful startups and follow what their founders build next. It is a discovery and progress platform, not an auction, click marketplace, or paid leaderboard. A startup may be free, paid, pre-revenue, or established; revenue and traffic are supporting context, never proof of quality.

Existing BidIndex products remain legitimate listings. Their IDs, slugs, media, owner evidence, support totals, redirects, transactions, and audit history are preserved. Historical support and bidding details are labelled as history and never enter a FounderTrail weekly launch score.

## Public experience

- **This week** contains only approved products whose founders or administrators explicitly scheduled a launch for the shown Monday-to-Monday UTC week.
- **Discover** supports server-side search, category and pricing filters, sorting, and pagination over all published products.
- **Updates** shows published founder progress posts.
- Product pages lead with identity, use case, audience, pricing, media, updates, and discussion. Optional metrics and historical context are secondary.
- Following, launch voting, and discussion require an account. Browsing remains public.

If no startup is launching this week, the page says so and displays real Discover results below it. Legacy products are never silently hidden or auto-enrolled into a launch.

## Founder experience

A founder can submit a startup for free, claim an existing listing in place, manage approved fields, publish updates, schedule one initial weekly launch, reply to feedback, and see qualified activity. New submissions and ongoing mutations require a server-validated account. Legacy proof can attach an old listing to an account but cannot remain a permanent mutation bypass.

Ownership can be established by a signed-in legacy credential exchange, an expiring domain-file challenge, or an audited administrator decision. A destination-domain change requires renewed review. Private contacts, credential hashes, provider identifiers, and evidence never belong in public responses.

## Launch integrity

Each product receives at most one initial launch. Each account can hold one active vote per launch and can undo it while the launch remains active. Owners cannot vote for their own product. Ordering is active votes descending, then approval time, then stable product ID. Results freeze after the week ends.

Legacy anonymous support is retained separately. The platform does not fabricate user identities or claim exact deduplication across eras.

## Metrics and trust

FounderTrail activity distinguishes qualified profile views, outbound clicks, followers, launch votes, comments, and sponsored traffic. An outbound click is not called a customer, verified arrival, or sale. Known bots, obvious repeats, and owner/admin testing are filtered prospectively; counts remain filtered estimates.

Optional connected metrics use one supported provider first: a founder-supplied, restricted read-only Stripe key. Keys are validated, encrypted at rest, scoped to exact Stripe products or an explicitly confirmed whole account, and removable with their snapshots. Published revenue remains separated by currency and includes source, scope, period, as-of time, and methodology. FounderTrail sponsorship does not use Stripe.

The existing domain/badge tracker remains optional and source-labelled. Installing it does not prove ownership, revenue, product quality, or improve launch order.

## Sponsorship

FounderTrail sells one exclusive, clearly labelled sponsored placement at a time: USD 9 base price for 168 consecutive hours, one-time, with no renewal. It appears on This week and Discover only, in the desktop rail or after the third organic result on mobile. It never changes organic order.

The purchaser must manage an approved listing. Creative and destination are reviewed before payment and snapshotted on the booking. Dodo Payments provides hosted checkout and verified payment/refund webhooks. Local transactions plus a PostgreSQL exclusion constraint prevent overlapping holds and bookings. A late or conflicting successful payment cannot displace another sponsor and enters the refund workflow.

Lemon Squeezy is not used for sponsorship advertising. Its old webhook and records remain only for historical reconciliation, and the old paid-ranking checkout is retired.

## Email and privacy

Magic-link sign-in and transactional email use Resend when configured. Promotional founder email requires recorded consent and supports suppression and one-click unsubscribe. Follows do not imply marketing consent. The weekly followed-product digest is off by default.

Account deletion cannot silently erase public products, ownership responsibilities, transactions, or required audit evidence. Owners must transfer or archive owned products first. Provider secrets and private evidence are minimized and excluded from public pages and logs.

## Operations boundary

The code ships with sponsorship disabled. Production activation requires a tested database backup/restore, isolated migration rehearsal and reconciliation, authentication/email checks, Dodo test-mode payment/refund checks, Stripe restricted-key checks, and responsive/accessibility review. See `docs/foundertrail/` for the exact runbook and verification gates.
