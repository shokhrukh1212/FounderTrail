# FounderTrail product brief

## Purpose

FounderTrail helps people find useful startups and follow what their founders build next. It is a discovery and progress platform, not an auction, click marketplace, or paid leaderboard. A startup may be free, paid, pre-revenue, or established; revenue and traffic are supporting context, never proof of quality.

Existing pre-rebrand products remain legitimate listings. Their IDs, slugs, media, owner evidence, support totals, redirects, transactions, and audit history are preserved. Historical support and bidding details are labelled as history and never enter a FounderTrail weekly launch score.

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

FounderTrail activity distinguishes qualified profile views, outbound clicks, followers, launch votes, and comments. An outbound click is not called a customer, verified arrival, or sale. Known bots, obvious repeats, and owner/admin testing are filtered prospectively; counts remain filtered estimates.

Founder-connected Stripe revenue and MRR are not part of this release. Existing records are retained privately for historical integrity, while the connection API returns `410 Gone` and no revenue claim is presented publicly.

The existing domain/badge tracker remains optional and source-labelled. Installing it does not prove ownership, revenue, product quality, or improve launch order.

## Free and Pro

Free includes the public startup page, ordinary launch scheduling, community votes/discussion/follows, founder updates, approved listing media, and existing basic statistics. Pro is a one-time per-startup purchase that adds Launch Studio and one private seven-day results summary. The first 20 qualifying live purchases are USD 5 before tax; later purchases are USD 9 before tax.

Pro never buys placement, ranking, votes, traffic, faster review, or a launch date. The visible Pro badge describes plan access, not identity or quality verification. Dodo Payments provides hosted checkout and signed payment/refund/dispute webhooks; browser return URLs never activate access.

All sponsorship sales and public sponsored placements are disabled. Historical sponsor and Lemon Squeezy records remain only for reconciliation and any operator-led obligation resolution.

## Email and privacy

Google is the only public sign-in provider. Transactional email uses Resend when configured. Promotional founder email requires recorded consent and supports suppression and one-click unsubscribe. Follows do not imply marketing consent. The weekly followed-product digest is off by default.

Account deletion cannot silently erase public products, ownership responsibilities, transactions, or required audit evidence. Owners must transfer or archive owned products first. Provider secrets and private evidence are minimized and excluded from public pages and logs.

## Operations boundary

The code ships with Pro checkout disabled. Production activation requires a tested database backup/restore, isolated migration rehearsal and reconciliation, authentication checks, a complete Dodo test-mode lifecycle, real PNG/report export inspection, and responsive/accessibility review. See `docs/foundertrail/PRO_LAUNCH_RUNBOOK.md` for the exact gates.
