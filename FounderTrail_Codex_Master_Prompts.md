# BidIndex → FounderTrail: Codex master implementation brief

Prepared: 21 September 2026.

## How to use this file

Put this file in your existing BidIndex repository. Give Codex this instruction:

> Read `FounderTrail_Codex_Master_Prompts.md` completely. Execute Prompt 1, then automatically execute Prompt 2 using the shared requirements in this file. Work in the existing repository. Finish the implementation and verification; do not stop after producing a plan. Preserve existing data and follow the production boundaries in this file.

Alternatively, run Prompt 1 and Prompt 2 in separate Codex turns. Keep this entire file attached or available for both turns. The shared requirements are part of both prompts.

**Working name:** FounderTrail. This is a suggested implementation name, not a claim that its domain or trademark is available. Put the name in one brand configuration so it is easy to replace. Keep the existing domain until the owner supplies a replacement.

**What this file is:** an implementation specification based on the owner's description and the earlier product discussions. The repository, database, and integrations have not been inspected by the author of this brief. Codex must discover the actual implementation before changing it.

**Payment correction:** the existing project may use Lemon Squeezy. Its published prohibited-products policy explicitly includes website advertising. The $9 sponsored placement must not use Lemon Squeezy checkout. Implement it through an eligible payment provider as specified below. This does not mean existing transaction history should be removed.

---

## Prompt 1 — Inspect the existing application and prepare a safe migration

You are working inside an existing, operating product called BidIndex. Act as the engineer responsible for preserving its data while changing its positioning and functionality.

Read this entire file, repository instructions, and relevant existing product, architecture, environment, operations, and handoff documents. Inspect the actual application, database models, migrations, API routes, analytics, authentication, owner management, email flows, payment handling, tests, and deployment configuration. Previous conversation context suggests a Next.js application with existing payment and admin foundations, but the repository is authoritative.

The owner says the application has not yet been changed to match the new concept. It contains more than 100 tracked products and private founder contact information. An earlier screenshot showed 108 products, 808 outbound clicks, and zero verified products; the owner reported almost 600 unique visitors. These are historical reference points, not current counts and not values to hardcode.

Your immediate task is to prepare the migration in this repository, not replace the application with a fresh scaffold.

1. Inspect git status and preserve unrelated work. Use an isolated branch or worktree if needed. Identify whether configuration points at local, staging, or production services before running commands that can mutate data.
2. Map all existing product records and identifiers, slugs, images, founder emails, ownership mechanisms, votes, comments, updates, visitor identifiers, event tables, counters, embeds, redirect links, admin roles, payments, and campaign tools that actually exist. Do not assume that every feature mentioned in the brief is already implemented.
3. Determine whether each statistic is backed by complete events, partial events, an aggregate counter, or an external analytics service. Identify the exact current definition of a visitor, unique visitor, click, and vote. Identify any duplicate counting that could be introduced by new tracking.
4. Identify a migration path that adds accounts, claims, ownership, launches, follows, sponsorships, and optional metric connections without replacing existing product identities or resetting historical counters.
5. Inspect the existing auth library and supported providers before choosing new dependencies. Inspect payment-provider eligibility for the planned advertising sale. Preserve useful existing integrations; do not route sponsorship through Lemon Squeezy.
6. Create `docs/foundertrail/AUDIT.md`, `IMPLEMENTATION_PLAN.md`, `MIGRATION_RUNBOOK.md`, and `PASS.md`. If these exact paths already contain relevant work, update them rather than duplicate them. List actual files and models, migration ordering, safe rollback, acceptance tests, environment prerequisites, and any real external blockers.
7. Build a repeatable baseline-and-reconciliation script for the existing schema. It must be able to compare product IDs, public URLs, ownership, private contact fields, historical counters, and related records across a rehearsal migration. Keep private exports and secrets outside git. No production writes are needed for this audit.
8. Identify the real backup/restore mechanism. Test restore against an isolated database when an authorised backup or representative test snapshot is available. If access is unavailable, provide the exact runbook and mark that test unperformed. Never claim to have backed up or verified production when you have not.
9. Record routine decisions and continue. Do not ask the owner to choose table names, CSS details, routine libraries, or every implementation phase. Ask only when an unavailable fact prevents a safe decision; continue all independent work first.

The output of Prompt 1 is a concrete implementation plan grounded in the repository, with working migration verification tooling. When instructed to execute both prompts, proceed directly to Prompt 2 without waiting for another approval of routine implementation work.

---

## Prompt 2 — Implement, integrate, and verify the complete product

Read this entire file and the results of Prompt 1. Implement all shared requirements below in the existing application. Treat this as an end-to-end product change: database, backend, frontend, permissions, integrations, admin, migration, tests, and operating instructions.

Do not stop after changing the logo and hero text. Do not deliver a static mockup, fake analytics, disconnected buttons, or a plan in place of working features. Work in small reviewable steps and keep `PASS.md` current so a later session can resume without repeating completed work.

Reuse the existing stack and working components. Choose the smallest maintainable implementation that satisfies the brief. Do not add unrelated systems, a microservice architecture, or a broad dependency upgrade.

Implement and test external integrations using their current official documentation and the versions installed in this repository. Use existing authorised test credentials when available. Missing credentials must not stop unrelated implementation. Complete the adapter, configuration, UI states, and meaningful fixture tests; clearly distinguish code-complete work from integrations actually exercised against a provider.

Use the development/preview environment to review the finished application. This brief authorises implementation and local or staging verification. A production migration, public deployment, bulk founder email, or real purchase needs explicit authorisation in the execution session; do not infer it solely from this file. Complete all reviewable work and the exact release procedure before asking about a production action.

At completion, report what changed, what was tested, how existing records are preserved, how to run the application, and any precise remaining owner configuration. Never claim that production data was preserved by a migration you have not run and reconciled. Never call an integration live solely because its mock test passed.

---

## Shared requirements

### 1. Product direction and founder value

Turn the existing bidding-products directory into a startup discovery and progress platform, open to all suitable startup categories. Initial messaging should resonate with independent founders and people looking for useful software. Existing bidding products remain legitimate historical listings in their relevant category.

The core experience combines:

- Discovery and launch discussion: people understand a product, try it, and ask questions.
- A lasting product profile: founders collect feedback and build an audience of followers.
- Ongoing progress: founders share meaningful releases and milestones after launch.
- Optional evidence: connected business metrics support relevant claims when founders choose to publish them.

Founder value is a useful public product page, an opportunity for discovery, direct feedback, followers, and a way to keep interested people informed. Visitor value is finding tools for a real task and following improvements that matter to them.

Avoid promises of guaranteed customers, revenue, leads, clicks, or virality. Revenue is supporting context, not proof that a tool is good. A startup earning $0 is welcome. Connection of a payment provider, installation of a badge, a paid plan, and social sharing are not conditions for a free listing.

The primary product is not an auction, click marketplace, or paid leaderboard. Keep traffic reports useful to founders without making clicks the public brand promise.

### 2. Brand and copy across the application

Use `FounderTrail` as the working display name in a central brand configuration. Separate display name, tagline, support contact, social links, and canonical site origin. Preserve the current real domain and backend identifiers.

Use these starting messages, polishing only for clarity:

| Location | Copy |
| --- | --- |
| Homepage heading | Find useful startups. Follow what they build next. |
| Homepage description | Discover new products, ask founders questions, and follow the updates that matter to you. |
| Primary homepage action | Explore startups |
| Founder action | Submit your startup — free |
| Founder value line | Launch your startup, collect feedback, and keep interested people updated. |
| Submission introduction | Give your startup a home for its launch and everything you build next. |
| Founder dashboard introduction | Manage your product, hear from users, and share your progress. |
| Updates introduction | See what founders are building, improving, and learning. |
| Sponsorship offer | Sponsor your startup for 7 days — $9 |
| Sponsorship explanation | A clearly labelled placement on our discovery pages, with a report of displays and outbound clicks. No automatic renewal. |

Replace BidIndex's own bidding-focused copy across navigation, page titles, metadata, footer, onboarding, FAQs, transactional email templates, empty states, and promotional surfaces. Remove the header's prominent bidding cross-promotion such as “Bid live on YourHour.” Existing product descriptions, transaction records, audit logs, and historical source data must not be globally rewritten.

Retain honest founder-written claims in their appropriate product context, subject to moderation. Do not silently alter the submitted description of an existing product to match the new platform message.

Use a simple original logo/wordmark that does not resemble bid arrows or an auction control. Reuse suitable existing visual assets and design components. Update favicon, web manifest, titles, descriptions, social preview metadata, and a clean 1200×630 OG image. Product-specific previews should use the product's real identity. Do not invent a domain or social handle.

Avoid publicly claiming “all verified,” “trusted by 100 founders,” or “customers delivered” based only on imported records or click totals. No fake testimonials, fake launches, or invented activity.

### 3. Information architecture and responsive homepage

Keep the existing application's restrained, readable visual character while making it feel like a product discovery community. Use a light background, strong typography, a restrained accent colour, compact useful rows, clear spacing, and accessible controls. Keep the hero short. Avoid an oversized dashboard of counters above the products.

Navigation: logo/home, search, Discover, Updates, Submit startup, and Sign in or an account menu. The account menu includes My products, Following, settings, and admin only when authorised. On mobile, keep navigation compact and the submission action easy to find without horizontal overflow.

Homepage tabs:

| Tab | Content and ordering |
| --- | --- |
| This week | Products explicitly scheduled for the current launch week; order by valid votes for that launch. |
| Discover | All approved public listings; searchable by name, description, category, and use case. Offer category and pricing filters and clearly named sorts. |
| Updates | Published feature releases, improvements, and milestones; newest first, with product identity and publication date. |

Use “Newest” as the straightforward default sort in Discover. Offer “Most followed” when real follow data exists. Do not invent an opaque popularity score or sort everything by revenue or clicks.

If the current week has no launches, show an honest short empty state and a visible Discover list below it. Never make the 100+ existing products look as though they have disappeared. Do not enrol every legacy product into a launch week automatically.

Product rows show logo, name, a clear one-line purpose, category, pricing model or known starting price, and compact actions. Product name opens its detail page. A separate Visit website action opens the actual startup. Avoid nested interactive elements. Show launch votes only where the launch context is clear. Unknown prices display “See website,” not “Free.”

Optional connected metrics can be secondary details. Remove clicks, revenue totals, ecosystem counters, empty verification cards, and bid amounts from the main homepage promise. Preserve historical numbers in the database and founder/admin reports. Do not delete data simply to declutter the UI.

Desktop: product list with a modest sponsor rail. Mobile: one column, readable descriptions, reachable actions, and the same sponsor after the third organic result. Do not render both hidden desktop and mobile variants in a way that doubles analytics. If fewer than three items exist, place the sponsor after the available list. With no paid sponsor, use the space lightly or show a small Advertise link; do not simulate a sponsor.

Search, filters, and pagination/load-more must use real data and preserve useful URL state and back-button behaviour. Avoid fetching every record merely to filter a growing catalogue in the browser.

### 4. Product pages and ongoing activity

Preserve existing canonical product paths. Add to the current detail page rather than creating parallel copies.

Page order:

1. Product identity, concise value, intended user, pricing, Visit website, Follow, and the relevant launch vote action.
2. Screenshots or demo when supplied; graceful fallbacks when absent.
3. Product description and public founder identity with optional social links.
4. Updates and discussions, with usable anchors or tabs.
5. Optional business metrics with source, scope, currency, period, and last refresh time.
6. Claim this product for unclaimed listings; Edit/Manage for authorised owners.

Founder emails and other private submission fields are excluded from public HTML, JSON, API responses, structured data, analytics payloads, and client bundles. Never expose owner tokens or provider credentials.

Use a simple product discussion with top-level comments and one reply level. A founder reply is labelled as such only when ownership is verified. Authors can edit their own comments with an edited marker; delete/hide behaviour preserves moderation records. Include reporting and an admin moderation queue. Sanitize user content.

Founders can publish an update with a title, short body, optional image/link, and type: Feature, Improvement, or Milestone. Include draft, preview, publish, edit, and archive actions. Manually entered milestone numbers are explicitly founder reported. Updates do not reset the product's launch date or start a new competition.

Follow is a unique user-product relationship. A signed-in visitor has a Following page with recent updates. A follow does not automatically opt someone into promotional emails.

### 5. Accounts, submission, ownership, and the existing founders

One personal account can browse, vote, comment, follow, and own multiple products. Do not force a permanent “founder versus visitor” role choice at signup.

Anonymous users can view all public discovery pages, product pages, discussions, updates, and external websites. Require authentication on the server for new submissions, votes, comments, follows, management, and purchases. Do not require sign-in merely to record a legitimate anonymous page view or outbound click.

Use the current auth system where suitable. Provide email code/magic-link sign-in and Google if it is properly configured. Use short-lived, single-use authentication tokens, secure sessions, rate limits, and a safe return path. Preserve the user's intended action after login; perform it once, not multiple times after refresh.

Do not merge identities merely because email strings match. Authenticate control of identities before linking. Avoid revealing whether a private founder email exists through login/claim responses. Admin privileges must come from an explicit protected server-side role, never a browser parameter or a public email field.

Existing product claim flow:

1. Open the existing product and select Claim this product.
2. Sign in and request ownership.
3. If the stored owner email has a trustworthy existing verification record, require fresh proof of access and explicit claim confirmation. An email merely typed into a public form is insufficient proof of ownership.
4. Otherwise verify control of the product domain using a challenge file or DNS record, or allow a documented manual admin review. Reuse any still-valid, securely verified existing ownership mechanism.
5. Atomically attach the account to the same product ID. A competing claim cannot replace an owner. Record who approved the claim, the evidence method, and the time.

Claim states: Unclaimed, Pending, Claimed, and Rejected/disputed as appropriate. Keep ownership status separate from submission approval and launch status. A lost-email case must be recoverable through domain proof or manual review.

Unclaimed products remain public with all their history. Do not create accounts or passwords for all stored emails, reset old products, or demand immediate registration from every founder. Provide an admin-selectable claim invitation workflow with previews; do not automatically send migration invitations.

New submission flow:

- URL first; safely fetch public metadata to suggest name, logo, and description. Protect server-side fetching from private/internal addresses, redirects to them, oversized responses, and timeouts.
- Founder reviews suggestions and adds category, pricing, intended audience, and optional screenshot/demo. Avoid a long form.
- Save draft; verify ownership; choose an available launch week if desired; submit for review.
- Listing status: Draft → Awaiting review → Approved/public, or Changes requested/rejected with a clear reason. Launch participation is optional and has its own status.
- Approved users can have a public listing without enrolling in this week's competition. Google/email signup alone does not prove domain ownership.

Prevent obvious duplicate domains/product URLs and offer the claim path. Handle distinct products on the same domain through manual review rather than merging blindly. Detect duplicates in the draft before forcing the founder to complete a second submission.

### 6. Launch rules and historical votes

Use weeks beginning Monday 00:00 UTC and ending the next Monday 00:00 UTC. Display the date range and timezone clearly. Use end-exclusive time ranges.

Only approved, explicitly scheduled products join a launch week. Once approved, a founder may schedule a future week or join the current week while understanding that it ends on the shown date. Do not promise seven full days for a late launch-week entry; sponsorship is a separate 168-hour purchase.

Each product gets one initial launch under the new system. Routine updates do not create relaunches. Preserve old launch records and dates. Any future relaunch feature requires a separate decision; it is not needed now.

Allow at most one active vote per authenticated account per launch, enforced in the database and server. Support undoing one's vote while the launch is active. Rank the weekly cohort by eligible votes, then a documented stable tie-break such as approval time and product ID. Paid placement and revenue do not affect rank.

Retain legacy votes as historical product support. Do not inject them into a new week's contest, erase them, or assign them to guessed new user identities. Show historical support and current launch votes with distinct labels when both are present. Where legacy identity evidence exists, prevent known duplicates; where it does not, do not claim exact cross-era voter deduplication.

Preserve final weekly results in an archive. If badges are generated, their text must identify the actual category/week and actual position earned. Do not award “winner” badges when no contest occurred.

### 7. Founder dashboard and sharing

Use practical sections: My products, Overview, Updates, Discussions, Audience, Metrics, and Promote. These may be tabs within a product workspace rather than many separate pages.

Owners can edit permitted product information, view claim/submission/launch status, respond to feedback, manage updates, see follower counts, and preview their public page. Changes to the destination domain or sponsor creative must trigger appropriate re-verification/review.

Reports show profile views, outbound clicks, new followers, votes and comments, for 7 days, 30 days, and all time where data supports those periods. Separate sponsored traffic from ordinary discovery. Use helpful language; an outbound click is not a customer, verified arrival, or sale.

Provide free shareable launch/update cards and a copy-link action. Use real product data and dates, not invented numbers. A founder can download a share image and voluntarily share it; do not auto-post or require social sharing. A simple earned launch/ownership badge can link back to the product page. It must accurately state what is verified and must not imply revenue verification.

Email preferences default to no promotional subscription. Offer an explicit weekly digest option for followed products with a clear unsubscribe action. Implement a durable, retryable, deduplicated digest job and relevant transactional templates. Send only opted-in content, batch sensibly, and avoid one email per tiny update. Migration does not imply newsletter consent.

Build the sending workflow and test it with a local inbox or authorised test recipient. Keep production campaigns and first bulk invitations under admin preview and explicit send controls. Never contact existing founders simply because this file is being implemented.

### 8. Data preservation and migration implementation

Treat preservation as a release requirement, not a best-effort task.

- Keep existing product IDs, canonical slugs, assets, timestamps, private contacts, votes, comments, ownership evidence, updates, event history, counters, and payment/audit records. Preserve external redirect and embed compatibility.
- Prefer additive schema migrations and ownership relations. Do not rebuild the production database, seed over production, renumber records, drop old tables, or run a destructive reset.
- If a route must change, provide a tested permanent redirect while maintaining inbound links and tracking. Changing the brand does not require changing the host/domain or every database name.
- Introduce nullable ownership for unclaimed legacy products. Existing products do not become hidden merely because newly required submission fields are missing.
- For complete historical events, preserve existing aggregation semantics. For counter-only history, preserve a clearly dated legacy baseline and add only post-cutover events. Never combine overlapping baselines and raw events twice.
- Preserve existing visitor IDs, cookie names, analytics property IDs, and deduplication rules where possible. Signing in must not create a second pageview. Do not sum separate periods' unique-visitor estimates and call the result deduplicated all-time visitors.
- If an analytics-definition correction is needed, keep the historical series and label the methodology change. Do not silently rewrite totals to appear consistent.
- Make the backfill restartable, with checkpoints and a fixed cutoff. Use a consistent snapshot and account for new events arriving during migration. Compare an identical historical window rather than expecting live counters to stand still.
- Preserve old anonymous comments and support totals without fabricating identities. New authentication rules apply to new actions, including legacy mutation endpoints; old edit tokens must not bypass the new ownership rules.
- Rehearse on an isolated database, run the migration twice safely or verify the migration system prevents reapplication, compare baseline reports, and prove new events add exactly once.
- Rollback must preserve writes made after release. Prefer reverting application behaviour/feature flags while retaining additive schema. Do not restore an old snapshot over newer user data as an automatic rollback.

Create or adapt the necessary models for users, ownership/claims, launches/votes, follows, updates, comments, notifications, analytics attribution, metric connections, bookings, payments, webhook receipts, and audit events. Reuse existing models whenever appropriate. This list defines capabilities, not a requirement to create this exact number of tables.

### 9. Analytics definitions and honest reporting

Separate four kinds of data: activity on this platform, referrals to startups, optional connected startup metrics, and this platform's own commercial revenue.

| Metric | Required definition |
| --- | --- |
| Platform unique visitors | Existing deduplicated estimate, with its method preserved and documented. Anonymous browsing counts. |
| Product profile views | Recorded view of the product detail page under one documented counting rule. |
| Outbound clicks | A real user activation of a product's external website action; not proof of arrival or conversion. |
| Sponsored impressions | The paid card is at least 50% visible for a continuous second in a visible browser tab; count once per booking per page-view ID. |
| Sponsored outbound clicks | Outbound clicks attributed to the active booking and placement. |
| Followers, votes, comments | Stored application actions with uniqueness/permissions enforced. |
| Startup website traffic | Optional connected analytics/tracker data with its source and period. |
| Startup revenue/MRR | Optional payment-provider-derived figures for the verified scope and currency. |
| Platform sponsorship revenue | Actual paid sponsorship orders, refunds, currency, and applicable tax/fee distinctions. |

Instrument only once. Do not count metadata previews, prefetching, link scanners, hidden responsive duplicates, or a server redirect plus a browser event as two clicks. Preserve ordinary navigation if analytics delivery fails. An unauthenticated outbound endpoint must resolve an approved stored product destination, not act as an arbitrary open redirect.

Use event IDs and source fields such as discovery, product page, update, share link, and sponsor booking. Separate total clicks from deduplicated clickers if both exist. Avoid calling repeated clicks unique visitors. Filter known bots, obvious repeats, and recognised owner/admin test activity prospectively; describe counts as filtered estimates rather than perfect human verification.

Keep private reports owner/admin-only. Do not leak other founders' analytics by changing a URL ID. Do not send private emails, auth tokens, payment-provider keys, or full URLs containing secrets to analytics.

At launch, follow and referral reporting must work without a startup installing code. Preserve any existing optional website tracker and embed integrations. Require domain ownership and clear consent before enabling new site tracking. A badge and tracking script are optional separate features; neither verifies revenue.

Do not build conversion attribution unless a suitable connection already exists. Show “Not connected” for startup signups or sales, not zero or an estimate based on clicks. Explain that these require an additional integration. Keep the data model extensible without creating a new attribution platform in this release.

### 10. Optional revenue and progress verification

Implement a real optional Metrics connection flow, not a permanently fake “Connect” button. Provide one secure, supported provider end to end first; prefer a restricted read-only Stripe connection if no suitable existing connector is available. This is distinct from the platform's sponsorship checkout.

The connection implementation must include permission validation, provider/account identification, product/account scope mapping, encrypted secret storage, server-only access, scheduled sync, pagination, retries, disconnect, and a useful last-refresh/error state. Check provider support rather than assuming every provider offers read-only keys. Never ask users to paste unrestricted secret keys when the necessary permission cannot be limited. Do not claim support for providers with no working adapter.

A payment account may contain several products. Match the connected metrics to the startup's actual provider products/subscriptions, or label account-wide metrics clearly after explicit founder confirmation. Prevent presenting the same entire merchant account as independently earned revenue of multiple products. An ownership claim and a payment connection are separate pieces of evidence.

At minimum, support the metrics that can be computed honestly for the selected provider: trailing-30-day collected revenue and current MRR. Define each formula in code and documentation. MRR is the monthly-normalised value of eligible recurring subscriptions; it is not all sales in the last 30 days. One-time purchases do not contribute to MRR. Annual recurring prices require monthly normalisation. Define treatment of discounts, refunds, tax, trials, cancellation, past-due states, and currencies. Do not add unlike currencies without a documented conversion source; prefer displaying them separately.

Store monetary amounts using precise minor-unit/decimal handling, never floating-point money arithmetic. Retain only the provider identifiers and minimum financial facts/aggregates needed for computation and reconciliation, not a customer contact database. Document retention and purge secrets on disconnect.

No connection means “Revenue not shared.” No data means unavailable, not zero. A stale connection shows the timestamp and stale status instead of claiming current verification. Publication of connected metrics is explicitly optional and independent of connecting privately. On disconnect or withdrawal of publication, remove public access to private metric data and cached copies as appropriate.

Use precise labels: “Ownership confirmed,” “Revenue connected,” “Traffic connected,” and “Founder reported.” Existing generic verification flags must be interpreted according to their real evidence, not silently upgraded into financial verification. Include a brief explanation that connected metrics reflect a defined provider scope and methodology, not an audit of profitability.

If provider credentials are missing, finish the connection code, tests, configuration, and conditional UI states. Keep unsupported controls unavailable, state the exact missing prerequisite in the handoff, and do not mark live revenue verification as completed. Do not block the core directory on a founder declining to connect.

### 11. Sponsored placement: exact commercial and display rules

The initial offer is **one exclusive sponsor at a time**, **US$9 base price**, **seven consecutive 24-hour days**, **one-time payment**, **no automatic renewal**. Disclose any applicable tax in checkout before payment. Centralise price and duration in server configuration; do not expose client-editable prices.

Both an existing approved listing and a newly approved startup may buy. They do not need to be launching that week. The purchaser must have authority to manage the listing. A new sponsor signs in, submits or claims the product, completes ownership/review, and then books. No separate external-ad submission system is needed.

The same active sponsor appears on the This week and Discover lists: in the desktop rail and after the third organic product on mobile, as defined above. The Updates feed is outside this initial paid placement. State these exact surfaces in the purchase preview. Do not imply placement on every product page, email, or social account. The card has a visible Sponsored label, real product identity, concise approved copy, and Visit website. Its normal organic listing remains.

Booking flow:

1. Select an owned approved product and open Promote.
2. Preview the desktop/mobile placement and see the actual scope, price, no-renewal rule, and reporting definitions.
3. Choose an available future start date/time. Display the exact start/end in the user's timezone and store UTC. End time is start + 168 hours; launch weeks are unrelated.
4. Create a short-lived server-side hold and open hosted checkout. Make provider checkout expiry consistent with the hold. A just-in-time start must allow enough checkout time; do not sell a period that has already started.
5. Confirm the booking only from verified provider evidence of successful payment. A browser success redirect alone does not mark it paid.
6. Show Scheduled, then Active for `start <= now < end`, then Completed. Evaluate time windows when serving content as well as through jobs so scheduler delays cannot keep an expired ad live.
7. Provide a campaign report for impressions and outbound clicks. Include zero states and dates. Never guarantee traffic or customers.

State handling includes Held/Pending payment, Scheduled, Active, Completed, Expired hold, Cancelled, Refund pending/Refunded, and Payment conflict or Failed where necessary. Do not confuse a payment state with a booking state.

Prevent overlapping paid bookings and holds with a transaction and a database backstop appropriate to the actual database, using end-exclusive intervals. Adjacent slots may touch; overlapping ones cannot both win. Do not rely only on a disabled date picker or an in-memory lock.

Handle concurrent checkouts, expired holds, retries, payment failure, delayed success, duplicate callbacks, out-of-order refund events, and payment success after another buyer acquired a released slot. A late/conflicted payment must not displace the other sponsor or silently move the buyer to different dates. Record it, notify the buyer through the normal transaction flow, and resolve it through a refund or an explicitly agreed replacement booking.

Before purchase, provide a clear cancellation/service-failure policy. Default: an unstarted booking can be cancelled for a full refund; once started, cancellation stops future display without an automatic full refund. Platform failure or inability to deliver a confirmed period requires a documented make-good or refund; do not silently shorten paid time. Keep admin refund actions audited and show their actual provider status.

Review creative before payment. Snapshot the approved destination and sponsor creative for the booking; ordinary product edits must not swap in unreviewed ad destinations. Let the owner request a reviewed correction rather than rewriting an active paid campaign unpredictably.

Empty sponsor inventory can show a modest Advertise link. Do not show fake sold-out status, misleading countdowns, or arbitrary automatic discounts. Keep an admin calendar with booked dates, available dates, payment status, and service issues.

The owner understands that one $9 booking each week produces roughly $39/month before fees. This is an initial willingness-to-pay test. Do not invent subscriptions, higher prices, multiple rotating sponsors, or paid ranking in this implementation.

### 12. Sponsorship payment provider and integration boundaries

Lemon Squeezy's official prohibited-products page includes website advertising. Therefore **do not reuse a Lemon Squeezy product or mislabel sponsorship as software access**. Keep existing historical payment records and any unrelated legitimate integrations intact.

Inspect whether an existing eligible provider/account is configured. Use it if it supports the actual sponsorship sale, hosted checkout, reliable payment confirmation, and refunds. If none exists, implement a provider adapter with a Stripe Checkout implementation as the documented default, provided the owner can use an eligible merchant account. The owner is based in Uzbekistan; do not assume location alone establishes Stripe account eligibility or create an account on their behalf. Stripe country/account requirements must be checked before live activation.

Finish and test the booking/payment integration using test mode or fixtures. Keep live purchase controls disabled until an eligible account and real secrets are configured. The public UI should simply say sponsorship booking is not available yet when disabled; setup details belong in the admin UI and handoff. Do not deploy a checkout that collects money while unable to schedule the promised placement.

Required implementation properties:

- Compute price, currency, product, booking, and purchaser identity on the server. Bind the provider checkout session to one valid local booking.
- Verify webhook signatures against the raw body and the configured endpoint secret. Separate test and live records.
- Confirm paid status, amount, currency, account/environment, and booking reference. Handle provider-specific asynchronous payment success/failure if those methods are enabled.
- Process each payment/order once with a durable event ledger and idempotent transaction. Duplicated or reordered events must not extend the booking, double income, or re-enable a refunded placement.
- Persist receipt of verified events before successful acknowledgement where processing is deferred; include retry/reconciliation jobs so a transient database failure does not lose a payment.
- Reconcile expired pending checkouts against the provider when needed, without extending holds indefinitely.
- Refunds need their own idempotency and retry state. Never show Refunded merely because a request was sent.
- Protect booking/status/refund endpoints with ownership/admin permission. Do not allow another user's booking to be read by guessing its ID.

Do not expose payment card data or secret keys. Document exact environment-variable names, callback URLs, webhook events, provider dashboard setup, test commands, and eligible-account requirements. Separate platform payment credentials from founders' private revenue connections.

### 13. Admin and founder contact management

Preserve and improve the existing admin area instead of replacing it with a placeholder. It must provide:

- A searchable product table: identity, domain, category, publication status, ownership state, founder contact, launch status, and recent activity.
- A private product detail view containing the submitted fields, founder email, optional region/country if already collected, claim evidence, history, and relevant analytics. Do not make region a new mandatory submission hurdle.
- Approval, changes-requested, and moderation workflows with clear reasons.
- Claim review and dispute handling, with an audit log of ownership changes.
- Comment/update reports and reversible hiding where possible.
- Launch scheduling and archives.
- Sponsor inventory, bookings, payment reconciliation, refunds, and income separate from startups' connected revenue.
- Metric connection health without revealing raw credentials.
- Migration baseline, reconciliation results, feature configuration, and background-job health.
- Existing contact/campaign functionality preserved. Support individual and selected-recipient claim invitations, preview, deduplication, send status, suppression/unsubscribe where applicable, and explicit admin Send actions. Do not silently add all founders to a marketing list.

Avoid selecting the same founder repeatedly because they have multiple products. Use verified relationships where available and clearly separate product count, known contacts, claimed founders, and registered accounts. A catalogue of 108 products is not proof of 108 registered founders.

Keep access checks server-side for every admin action and export. CSV exports must be protected against spreadsheet formula injection. Record critical ownership, moderation, billing, and campaign actions without logging secrets.

### 14. Privacy, quality, and operational behaviour

Reuse existing privacy/settings patterns and update public explanations to match implemented tracking, accounts, optional metric sharing, sponsored placement, and email preferences. Retain any existing consent controls; do not remove them to simplify analytics. Provide account deletion/disconnection behaviour that explains what happens to public contributions and product ownership, while preserving required transaction/audit records under the site's actual policy. Do not blindly delete public products through an auth-user cascade.

Use input validation, server-side permissions, CSRF protection as appropriate, safe URL handling, upload validation, and rate limits for abuse-sensitive operations. A paid booking cannot bypass product moderation or ownership verification.

Include proper loading, empty, success, validation, expired-token, permission-denied, and error states. No user should see a raw database error or secret configuration value. Missing optional integrations must not crash discovery pages.

Support keyboard navigation, labelled inputs, visible focus, accessible dialogs, sensible contrast, reduced motion, and mobile touch targets. Keep the product usable at 360px, 390px, 768px, and desktop widths. On mobile, make the first real products and a useful action visible without an oversized hero.

Preserve SEO value: current product URLs, canonical host, accurate metadata, public-page indexing, sitemap entries for published content, and noindex for private dashboards/auth/admin/drafts. Keep existing embeds and redirects working after the display-name change. Never expose private data in structured metadata.

Use real content for authenticated and public flows. Any sample fixtures must be isolated to development/tests and clearly marked. Do not import fabricated founders or traffic into production to make an empty state look active.

### 15. Implementation sequence

Complete these phases without waiting for routine approvals between them:

1. Audit, preservation baseline, and migration rehearsal tooling.
2. Additive models, server permissions, account flows, claims, and legacy compatibility.
3. Brand/copy, responsive discovery pages, product pages, and submission review.
4. Launch scheduling/votes, follows, discussions, founder updates, and sharing.
5. Owner/admin dashboards, honest analytics, notification preferences, and email jobs.
6. One real optional revenue connector with secure publishing controls.
7. Sponsored inventory, booking, eligible-provider checkout adapter, reconciliation, and reports.
8. Migration rehearsal, functional/security/visual checks, and release handoff.

Preserve functioning features throughout. Phases are checkpoints, not reasons to end the task early. Document a blocked external prerequisite precisely and finish every independent phase.

### 16. Acceptance tests that determine completion

Use the repository's existing testing stack. Add meaningful tests around the migration, identity, money, and event-counting risks. Run existing lint/type checks, relevant tests, and the production build. Do not invent test counts or repeatedly run broad suites without a remaining risk.

| Area | Required proof |
| --- | --- |
| Historical records | Rehearsal preserves all original product IDs/URLs, contacts, content, and baseline counts, including counter-only legacy cases. |
| Restart and concurrency | Interrupted/retried backfill does not duplicate data; events arriving during migration are neither lost nor counted twice. |
| Anonymous browsing | Visitor can discover, open profiles, read discussion, and visit startup websites without login. |
| Auth gates | New comments, votes, follows, submissions, purchases, and management require server-validated sessions on new and legacy routes. |
| Claim correctness | An unclaimed legacy product is claimed in place; wrong-email, unverified-email, replayed-token, conflicting-owner, and cross-user attempts fail safely. |
| Multiple products | One verified account can manage its several products, without seeing another owner's private reports. |
| Submission | URL suggestions, edits, draft recovery, ownership proof, admin review, publishing, and duplicate/claim routing work. |
| Legacy activity | Old comments/support remain visible; no fake accounts; old votes do not inflate new weekly competitions. |
| Weekly launch | Week boundary, late join, stable ranking, vote uniqueness/undo, frozen historical result, and ordinary-update behaviour match the rules. |
| Following/discussion | Login returns to the intended action once; follow/unfollow, comments, founder replies, edits, reporting, and moderation work. |
| Updates and email | Update publication reaches the feed; digests include only eligible opted-in users and deduplicate retries; unsubscribe works. |
| Tracking | One outbound action counts once; no tracking duplication from prefetch, hidden layouts, browser/server handlers, or sign-in transition. |
| Revenue | Restricted access, product scope, recurring-vs-one-time calculations, annual normalisation, currency separation, disconnect/privacy, pagination, and stale/error states work. |
| Sponsor permissions | Existing/new approved products can book; unclaimed, rejected, and unauthorised products cannot bypass review. |
| Booking collisions | Two simultaneous attempts for overlapping inventory cannot both succeed; adjacent slots can. |
| Payment integrity | Client price tampering, forged/replayed webhook, wrong amount/currency/environment, delayed payment, refund-before-success, and duplicate fulfilment are handled. |
| Sponsor display | Paid placement appears in its advertised desktop/mobile position only within the booked 168 hours; no hidden-layout double impressions. |
| Refund/reconciliation | Failed/late/conflicted payments and provider retry paths are visible, recoverable, and never marked refunded prematurely. |
| Privacy/admin | Public APIs and pages omit emails/keys/tokens; all private actions enforce permissions; exports and audits behave safely. |
| Brand and navigation | No platform-owned bidding promises remain on active marketing pages; existing product descriptions/history are preserved. |
| Visual quality | Inspect screenshots at the required mobile/tablet/desktop widths; check long names, missing logos, zero data, errors, keyboard focus, and overflow. |

Use isolated synthetic fixtures to cover missing edge cases, and a protected authorised data snapshot for migration rehearsal when available. Never run purchases, emails to real founders, destructive test resets, or synthetic event generation against production during verification.

### 17. Required handoff

Update the documents from Prompt 1 and add focused `SETUP.md` and `VERIFICATION.md` under `docs/foundertrail/` if equivalent documentation does not already exist. Keep an explicit status table: Implemented, Tested locally, Tested with provider, Requires configuration, or Not completed.

Include:

- The new product behaviour and the files/models that changed.
- Actual migration and backup/restore commands for this stack, ordering, staging rehearsal evidence, historical cutoff, and reconciliation results.
- How to revert application behaviour without discarding new data.
- Environment variables and provider/dashboard setup, with no secret values.
- How to review claims, launch weeks, founder contact lists, digests, sponsor bookings, and refunds.
- Exact limitations of historical statistics and any new metric definitions.
- Evidence from tests/build and mobile/desktop screenshots, identifying unperformed checks honestly.
- A production release sequence: verified backup, compatible additive migration, safe application rollout, backfill/reconciliation, smoke checks, and separately controlled activation of real payments/emails.
- A short final message in easy English covering what works and only the genuine remaining owner actions. Include the working-name/domain distinction and sponsorship payment prerequisites.

Do not mark the project fully live if auth/email/payment/revenue credentials or production rollout remain unconfigured. Do not conceal unfinished core code under the phrase “future improvement.” Deliver the working implementation and exact boundaries.

---

## Official references checked for this brief

These are factual implementation references, not instructions to copy either platform's branding or every feature. Check their current versions when implementing. Product choices and prices in this brief are our proposed design.

1. [Product Hunt: Getting Started](https://help.producthunt.com/en/articles/2305333-getting-started) — public discovery, daily launches, participation, and sharing. Our product intentionally starts with weekly groups.
2. [TrustMRR FAQ](https://trustmrr.com/faq) — provider-connected revenue, optional public metrics, and source/refresh concepts. Use an honest methodology for our connector; a connection is not a profitability audit.
3. [Auth0: User Account Linking](https://auth0.com/docs/manage-users/user-accounts/user-account-linking) — authenticate control before linking identities. This is security guidance, not a requirement to migrate to Auth0.
4. [Lemon Squeezy: Prohibited Products](https://docs.lemonsqueezy.com/help/getting-started/prohibited-products) — website advertising is prohibited; do not reuse it for sponsorship checkout.
5. [Stripe: Global Availability](https://stripe.com/global) — verify merchant-account eligibility before activating a Stripe sponsorship adapter.
6. [Stripe: API Keys](https://docs.stripe.com/keys) — restricted permissions and secure server-side credentials for optional revenue connections.
7. [Stripe: Webhooks](https://docs.stripe.com/webhooks) — signed events, retries, duplicates, and payment event handling.
8. [Stripe: Checkout Fulfilment](https://docs.stripe.com/checkout/fulfillment) — provider-confirmed fulfilment, not browser success-page trust.
