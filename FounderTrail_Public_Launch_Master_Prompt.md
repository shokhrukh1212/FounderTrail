# FounderTrail public-launch master prompt

You are working inside the existing FounderTrail repository. The application already runs locally and already contains real historical data. Implement this plan completely in the current stack and design system. Start by reading the repository, migrations, environment examples, tests, and any `AGENTS.md` files. Do not replace working architecture simply because you prefer another stack.

## Product direction

FounderTrail is a community where founders launch a startup, find early supporters, collect useful feedback, and publish updates. Visitors discover startups, upvote them, follow them, comment, and visit their websites.

Keep the current name and visual direction. Use this landing-page message:

- Heading: **Launch your startup. Find your first supporters.**
- Founder copy: **Share what you’re building, collect useful feedback, and keep early users interested with every update.**
- Visitor copy: **Discover new startups, upvote the ones you believe in, and follow their progress.**
- Primary CTA: **Submit your startup — free**
- Secondary CTA: **Explore startups**

Weekly launches, organic community rankings, and paid sponsorships must remain separate systems. Payment must never change an organic rank, vote count, comment count, or launch position.

## Non-negotiable data protection

There are already more than 100 real startup records and historical engagement. Before changing schemas or behavior, inspect and document the current data model and create a backup/export procedure. Use additive, reversible migrations and idempotent backfills.

Preserve every existing:

- startup/product ID, slug, URL, logo, description, category, pricing field, screenshots, founder contact, and status;
- historical upvote/support total, authenticated vote, follower, comment, update, outbound-click count, visitor count, launch record, and timestamp;
- admin correction, moderation decision, and ownership relationship;
- public URL and search-engine-visible page where practical.

Never reset, recompute, merge, or renumber historical engagement unless a documented migration proves it is necessary. Historical support and new authenticated votes must not be double-counted. Show a dry-run reconciliation before and after migrations. The current admin baseline has shown 113 records; confirm the live local value instead of hard-coding 113.

## Work order

Implement in this order:

1. Diagnose and repair ownership claims.
2. Improve the startup submission experience.
3. Implement sponsor inventory, checkout, placements, reporting, and admin controls.
4. Prepare founder claim invitations.
5. Complete launch QA, setup documentation, and an operator runbook.

Do not build Stripe revenue/MRR verification in this release. The current operations page shows metrics encryption still needs configuration and background jobs are absent. Keep any existing incomplete metrics code disabled behind a feature flag, remove dead public CTAs, and document it as a later phase. Do not request or store a founder’s unrestricted Stripe secret key. A later version should use Stripe OAuth/Connect or a narrowly restricted read-only key, encrypted at rest, with explicit consent, disconnect/delete controls, durable sync jobs, and clear definitions for MRR and revenue.

## 1. Fix the ownership-claim flow

The product page currently shows **Could not start the claim.** The admin page shows **No pending claims.** This means no usable claim reached the moderation queue. Do not guess at the cause. Reproduce it and trace the browser request, server handler, authentication state, database/RLS policy, migrations, verification provider, environment variables, and server logs.

Repair the root cause and add useful observability. In local development, log a correlation ID and actionable server error without exposing secrets. In production, show a friendly message plus the correlation ID. Do not swallow claim errors.

Required user flow:

1. A visitor can view any startup without signing in.
2. Clicking **Claim this startup** requires Google sign-in and then returns to the same startup page.
3. A signed-in user can start a claim even when automatic domain verification is unavailable. The fallback is a pending manual-review claim.
4. If domain verification is configured, offer proof by the existing supported method, such as DNS TXT or a well-known file. Generate a random, expiring challenge and verify it server-side.
5. Starting a claim creates exactly one pending claim for that user/startup pair. Repeated clicks are idempotent.
6. A verified claim can be auto-approved only when proof is strong. Otherwise it enters admin review.
7. The admin Ownership Claims list shows the startup, claimant name and email, creation date, method, verification state, safe evidence, and Approve/Reject actions.
8. Approval grants management rights without altering the startup’s history, engagement, slug, or launch records.
9. Rejection records a reason and lets the claimant try again when appropriate.
10. Already-owned startups show the owner and do not accept duplicate claims unless an admin starts an ownership-transfer flow.

Add meaningful tests for authentication return URLs, claim creation, idempotency, permissions, approval, rejection, and history preservation.

## 2. Founder invitations for existing listings

Build a safe way to invite the existing founders to claim their listings. Do not send any real email during implementation, migration, seed, preview, or tests.

Add an admin invitation tool that:

- filters approved unclaimed startups with a stored founder email;
- supports selecting one, several, or a small batch;
- previews the exact recipients and email before sending;
- creates a cryptographically random, hashed-at-rest, single-use, expiring invitation token tied to one startup and recipient;
- records created, sent, opened, claimed, expired, failed, and revoked states;
- rate-limits sending and supports resend/revoke;
- uses the existing email provider when one exists, otherwise adds a small provider abstraction and documents the recommended provider configuration;
- never treats an imported or scraped contact as marketing consent.

Invitation link flow:

1. Founder opens the startup-specific link.
2. Founder signs in with Google.
3. Founder sees the correct startup and the engagement already preserved on it.
4. Founder submits the claim. A matching invited email is useful evidence but is not enough to prove ownership when the original contact was never verified; keep manual review or domain verification available.
5. Admin approves, or strong configured domain proof auto-approves.

Email subject: **Claim your startup on FounderTrail**

Email body should be short and factual: the startup is already listed; include its current real upvotes, followers, and outbound clicks only when available; explain that claiming lets the founder edit the profile, publish updates, schedule a launch, and see reports; include one **Claim your startup** button; include a plain-text URL and support contact; do not promise traffic or rankings.

Provide an admin export and a preview mode. The operator should first invite 10–20 founders, verify delivery and completion, and then send later batches manually.

## 3. Improve startup submission

The current form is functional but too long. Convert it into a responsive three-step flow while preserving Save draft and all current fields.

### Step 1 — Website

- Website URL
- **Fetch startup details**
- Loading, timeout, blocked-site, and partial-result states
- Detect an existing normalized domain before creating a duplicate
- If an existing listing is found, route to its claim flow
- Only show a shared-domain/distinct-product option after a duplicate-domain match; remove the confusing checkbox from the default form

### Step 2 — Startup details

- Logo
- Startup name
- One-line description with visible character count
- What it helps people do
- Who it is for
- Category, required
- Pricing model, required, with optional known starting price/currency
- Up to four optional screenshots with preview, replacement, removal, size/type validation, and accessible alt text support

Fetched values remain editable and must never silently overwrite founder edits.

### Step 3 — Founder and review

- Prefill founder name and contact email from the Google account when possible
- Explain that contact email is private
- Optional founder social handle
- Separate unchecked marketing opt-in
- Accurate preview of the listing
- Required authorization/accuracy attestation
- **Save draft** and **Submit for review**

After a free submission, show a success page explaining review and launch scheduling. Include a secondary **Promote this startup** option only after the listing is approved and ownership is confirmed. A free submission must never feel blocked by payment.

## 4. Sponsorship product

Launch one simple sponsorship product with three concurrent inventory slots site-wide:

- **7 days: $20**
- **30 days: $60**
- Show **Save $20 (25%)** for 30 days compared with four 7-day purchases.

These are fixed-duration one-time purchases, not auto-renewing subscriptions. Define start and end timestamps precisely in UTC and display the buyer’s local dates where practical.

### Entry points

- Add **Advertise** to the public header.
- Add **Promote** inside the dashboard for owned/claimed startups.
- Add **Promote this startup** on the approved-submission success page.
- Anyone may view the Advertise page. Checkout requires Google sign-in and an approved startup that the buyer owns or is authorized to market.
- Someone without a listing may begin on Advertise, but route them through a shorter startup submission and approval/claim process before payment. Do not allow payment for an unreviewed, unowned, or prohibited listing.

### Advertise page

Explain the offer in plain English. Show the placements, three-slot scarcity, price, exact duration, available start dates, content rules, refund/cancellation policy, and what is measured. Do not promise sales, rankings, backlinks, or a fixed number of clicks.

Show only factual live metrics fetched from real data, such as approved startups, outbound clicks, or all-time visitors. Label each metric and its time range. Ahrefs Domain Rating may appear here as a secondary, manually maintained proof point in the form **Ahrefs Domain Rating: 25 — checked [date]**. Link to the source/checker and explain that DR is Ahrefs’ backlink metric. Do not put DR25 in the global header and do not call it Google authority.

### Buyer flow

1. Sign in with Google.
2. Select an owned, approved startup.
3. Choose an available start date.
4. Choose 7 or 30 days.
5. Preview all placements and the Sponsored/Promoted labels.
6. Accept advertising terms.
7. Complete hosted checkout.
8. Activate only after a verified successful-payment webhook.
9. Show confirmation, campaign dates, placements, and reporting link.

Prevent overselling with database-backed capacity checks and a transaction/constraint appropriate to the current database. There may be no more than three active or reserved paid slots for the same instant. Checkout reservations must expire automatically. Webhook processing must be signature-verified and idempotent.

Use the existing Dodo Payments integration if the merchant account and product are eligible for digital advertising services. Use hosted one-time checkout, not a subscription. Implement sandbox mode first. Treat the webhook as the source of truth and activate on the documented successful-payment event. Handle failed payments, refunds, disputes, chargebacks, expiration, and duplicate/out-of-order events. Store provider IDs and raw event IDs safely, but never secrets. If Dodo eligibility is uncertain, leave production checkout disabled with a clear admin health message and document that the operator must get provider approval; do not silently switch processors.

### Placements

Keep organic rankings untouched.

1. **Homepage:** Add a clearly titled **Featured sponsors** section below **Startups launching this week** and above **Community favourites**. Show up to three active sponsor cards. The section disappears cleanly when empty.
2. **Discover/directory:** Insert active sponsored rows after organic rows 3, 8, and 13. Sponsored rows have no organic rank number, never displace or renumber organic results, and carry a visible **Promoted** label. If fewer than three sponsors are active, use only the available rows.
3. **Startup detail pages:** Show one compact sponsored card after the overview/stat area and before discussion. Rotate active sponsors evenly and exclude the startup currently being viewed.

Use the startup’s approved logo, name, one-line description, category, and CTA. The prominent ad CTA opens the sponsor’s website in a new tab through existing outbound-click tracking. A smaller **View profile** link may open the internal FounderTrail page.

Every paid external link must be marked `rel="sponsored noopener noreferrer"`. User-submitted free listing links should use an appropriate `ugc`/moderation policy. Admin-curated editorial links may be normal links. Never sell or advertise “dofollow links.” Keep sponsorship labels visible and accessible.

### Tracking and reports

Track server-trusted campaign impressions and outbound clicks by campaign, startup, placement, and day. Deduplicate obvious retries/bots using the project’s current privacy approach. Do not call clicks customers or confirmed visits. Give the sponsor a report containing:

- campaign status and dates;
- impressions;
- outbound clicks;
- CTR;
- placement breakdown;
- daily trend;
- a clear note that results are traffic signals, not guaranteed customers.

Do not expose visitor IP addresses or other users’ personal data.

### Sponsor admin operations

Upgrade the sponsor calendar so the operator can see each day’s capacity as `used / 3`, campaigns, reservations, start/end times, payment state, approval state, and conflicts. Add filters and detail views. Allow authorized admins to pause, resume, cancel, refund-record, or create a clearly audited complimentary campaign. Never silently delete payment history. Add health cards for Dodo configuration and last webhook received.

## 5. Admin operations wording

Keep and clarify the existing operations page:

- **Ownership claims** is the moderation queue for claim attempts. Empty means no claim request is waiting, not that claiming is configured correctly.
- **Category and pricing review** contains automated suggestions. **Apply correction** saves an admin-owned override that later enrichment cannot overwrite. **Keep current** records the review decision and removes the item from the active queue.
- **Sponsor calendar** is inventory availability. An open slot is not a sale.

Add short help text in the interface so the operator does not have to infer these meanings.

## Security and permissions

- Public browsing requires no account.
- Google sign-in is required for votes, follows, comments, submissions, claims, startup management, launch scheduling, and sponsorship checkout.
- Enforce authorization on the server for every mutation. UI hiding is not authorization.
- Only owners/authorized managers can edit or advertise a startup.
- Only admins can approve/reject claims, approve listings, correct classifications, manage sponsor campaigns, or see founder contact data.
- Validate and normalize URLs, prevent open redirects, sanitize text, rate-limit abuse-prone endpoints, verify uploads, and keep secrets server-side.
- Preserve the current admin access method until a tested Google-admin allowlist replacement is complete. Document any admin environment variables.

## UX and responsive behavior

Match the current clean FounderTrail design. Avoid a marketplace full of ads. Sponsored content must be noticeable but clearly separated and labeled. Provide useful empty, loading, error, success, and disabled states. Keyboard navigation, focus states, labels, contrast, screen-reader text, and mobile layouts must work.

## Verification

Add only meaningful tests around data preservation, claims, authorization, inventory conflicts, webhook idempotency, campaign activation/expiration, link attributes, organic rank isolation, and submission duplicate handling. Test sandbox checkout end to end with documented provider fixtures. Run the project’s lint, type check, tests, and production build. Fix failures caused by this work.

Manually verify at desktop and mobile widths:

- anonymous browsing;
- Google sign-in return flow;
- a new claim reaching admin review;
- claim approval preserving history;
- existing-domain submission routing to claim;
- three-step submission and draft recovery;
- no-sponsor, one-sponsor, and three-sponsor layouts;
- no fourth overlapping campaign can be purchased;
- successful, failed, duplicate, and out-of-order payment webhooks;
- campaign start and automatic expiration;
- sponsored links have `rel="sponsored"`;
- sponsored rows never receive organic rank numbers;
- no historical metric changed unexpectedly.

## Deliverables

Complete the implementation. Then provide:

1. A concise list of what changed and why.
2. Every migration and backfill, including dry-run/reconciliation results.
3. Test, type-check, lint, and build results.
4. Exact environment variables, where to obtain each value, and local/production setup steps for Google auth, email, Dodo sandbox/production, webhook secrets, claim verification, and Ahrefs proof metadata.
5. A short operator runbook covering claim review, founder invitation batches, category/pricing review, sponsor approval, calendar conflicts, refunds, campaign pausing, and provider failures.
6. Screenshots or a local preview of the changed landing page, submission flow, claim states, Advertise page, sponsor placements, buyer report, and admin operations.
7. A list of deferred work. Stripe revenue/MRR verification must appear here rather than being partially exposed in production.

Do not stop after writing a plan. Inspect the actual code, implement the work, migrate safely, verify it, and leave the repository in a reviewable state. Do not deploy, send founder emails, enable live payments, or modify production data unless the operator has explicitly authorized that separate action.
