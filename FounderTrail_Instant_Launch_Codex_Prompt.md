# FounderTrail — instant publishing, launch scheduling, and sharing

**Implementation brief and master prompt for Codex / Claude Code**  
**Date: October 1, 2026**

## The product decision

Make the normal journey:

**Sign in → enter startup details → publish and launch now → share the public page → prepare and share the launch kit.**

A founder can choose a future launch date or publish without launching. Their public page goes live immediately in all three cases. New submissions belong to the signed-in submitter's account immediately; they do not need a second ownership application or an administrator's approval.

The final submission step defaults to **Launch now**, with that choice clearly visible. The submit button says **Publish & launch now**, so the founder knows what will happen. This is more effective than publishing first and hoping the founder discovers launch scheduling somewhere else.

After submission, show a useful launch workspace with their page, launch status, and sharing actions. Free sharing is available immediately. Pro adds the launch kit benefits already implemented.

This removes the normal waiting period. It does not mean that submitting an existing startup URL grants access to another person's account or private reports. Existing listings need a short, automatic account-matching path wherever reliable evidence exists.

The homepage screenshot shows an empty weekly launch section above an active directory. This plan addresses both the missing launch action and the empty presentation. It cannot guarantee new submissions every week; when there are no real launches, the homepage should lead with real directory content.

---

## Master implementation prompt

You are working in the existing FounderTrail repository. Implement this brief end to end using the current stack and design system. Read the repository instructions and inspect the current submission, authentication, publishing, ownership, launch, sharing, Pro, analytics, and admin code first.

This is a change to the existing product, not a rebuild. The screenshots describe observed behavior; do not assume the database or routes have a particular shape. Adapt the requirements below to the real implementation.

The user's latest decision supersedes the previous requirement for routine manual submission approval and separate ownership verification for new submissions. Preserve existing records and paid benefits. Do not introduce the larger feedback/progress strategy from another document in this task.

### 1. Publish new submissions immediately

For a valid submission from an authenticated Google account:

1. Validate the required startup fields on the server.
2. Check whether the startup already has a listing.
3. For a genuinely new listing, create/publish it and associate management access with the authenticated account in the same database transaction.
4. Create its launch record if the founder chose to launch now or schedule a date.
5. Return its stable public URL and take the founder to the launch workspace.

The public page must be readable without signing in immediately after success. Management, editing, scheduling, Pro purchases, and private reports stay restricted to authorized accounts.

**Remove these requirements from the normal new-submission path:**

- Waiting for administrator approval.
- Clicking “Claim this startup” after submitting it.
- DNS, domain-file, or badge verification before the submitter can manage their new page.
- Payment, sharing, or a Pro purchase before publication or launch.

Keep the existing short declaration that the person built the startup or is authorized to submit it. The account association grants listing-management access; it is not proof of company ownership. Do not automatically award a “Verified company” or domain-verification badge. The Pro badge continues to mean a paid Pro upgrade.

Keep basic automatic checks: valid public website URL, required fields, supported uploads, duplicate detection, existing account restrictions, and reasonable submission limits. Keep URL-fetch protections against private-network access and unsafe redirects. Missing optional metadata or a failed screenshot fetch must not force an administrator review when the founder supplies valid details manually.

Admin moderation becomes **moderation after publication**: administrators can hide spam, resolve reports, correct listings, and suspend abuse. Preserve those tools and their audit history. Invalid or restricted submissions get a clear actionable error, not a misleading success message.

### 2. Replace the final submission step with “Review & launch”

Keep the existing website/details steps. Rename the final step from “Founder and review” to **Review & launch**.

Layout, in order:

1. Compact startup preview: logo, short name, one-line description, categories, website.
2. Prefilled founder/contact details, retaining current privacy settings and optional marketing consent.
3. A launch choice with three radio options.
4. The existing authorization declaration.
5. Back, Save draft, and one primary submission action.

Use these launch choices:

| Choice | Default | Explanation | Primary submit button |
| --- | --- | --- | --- |
| **Launch now** | Selected | Publish your page and join this week's launches immediately. | **Publish & launch now** |
| **Choose a launch date** | Unselected | Publish your page now. Join the launch list on your chosen date. | **Publish & schedule launch** |
| **Publish my page only** | Unselected | Publish now and choose a launch date later. | **Publish startup** |

All choices are free. Never silently change the founder's saved selection when they navigate back or restore a draft. Old drafts with no selection can receive the new visible default when the founder revisits this step; loading a draft must not publish anything.

If the existing Pro choice remains here, keep it compact and optional. Publication and the selected launch must succeed independently of checkout. Save the startup before opening any Pro checkout. On cancellation, failure, or delayed payment, return the founder to their already published startup's workspace with a clear status. Payment success must not create another listing or launch.

Replace obsolete normal-flow wording such as “Submit for review,” “Awaiting approval,” and “Verify ownership to launch.” Update related help text, dashboard gates, and existing submission confirmations so they agree with instant publication. Preserve email preferences and do not add a new marketing campaign.

### 3. Define publishing and launching separately

Use separate facts for page publication and launch timing, even if the current database uses different field names:

- **Published page:** visible in discovery and at its public URL.
- **Not scheduled:** published page, no launch date chosen.
- **Scheduled:** published page, a future launch start exists.
- **Launched:** launch start has arrived.
- **Past launch:** the launch remains in history after its homepage week ends.
- **Hidden/suspended:** unavailable publicly and excluded from discovery/launch lists.

“Launch now” sets a real launch start at the server's current time. It does not backdate to Monday. No administrator action or next-week queue is required.

Reuse the current documented weekly calendar if it is consistent. If no reliable definition exists, use Monday 00:00 UTC through the following Monday 00:00 UTC, with a half-open interval. Store instants in UTC and show the founder their local date/time and the platform week where relevant.

For future scheduling, show a date/time picker in the founder's local timezone and the resulting launch-week label. Default the time to 09:00 local on their chosen future date. Reject past instants. Make the timezone visible and account for daylight-saving changes where applicable.

For a launch near the end of a week, show “This week's list ends [local date/time]” and allow the founder to choose next week. Do not imply that appearing in a calendar-week list always provides seven full days on that list.

The main “Startups launching this week” list includes published, unhidden startups whose actual launch start is within the current platform week and is not in the future. Future launches appear under a clearly labelled **Coming up** section only when there are real scheduled items. A scheduled launch becomes current when its time arrives.

Keep the existing launch-vote definition, eligibility, and ranking where they work. Preserve historical upvotes. Lifetime votes must not be silently represented as votes earned during this week's launch. If there is no established weekly ranking, order by valid launch-specific upvotes, then launch start, then stable ID. Pro must not change organic ordering.

Keep one active or scheduled launch per startup. Repeated button presses or rescheduling must not create multiple entries. Allow future launches to be rescheduled or cancelled before they start. Do not add unlimited repeat launches or a way to reset ranking by pressing “Launch now” repeatedly; preserve any existing supported relaunch policy.

The Pro results summary remains a seven-day report under the existing purchase/report rules. Inspect those rules and preserve paid entitlements. If no start rule exists, use the actual launch start plus seven consecutive days; weekly homepage membership is a separate window. A summary with zero activity must still be available and accurate.

### 4. Build the post-submission launch workspace

Use a dedicated, revisitable page inside the existing management area. Avoid a large compulsory modal or a chain of pop-ups. Persist progress so closing the tab does not lose anything. Public visitors must never see the private checklist.

At the top show the startup logo, short name, status, public URL, **View public page**, and **Copy link**. Link to this workspace from the startup dashboard after onboarding as well.

Use state-specific headings:

| Current state | Heading | Supporting text |
| --- | --- | --- |
| Launched now | **[Name] is live and launching this week.** | Your page is ready. Invite people to try it, leave feedback, and follow your progress. |
| Scheduled | **[Name]'s page is live. Your launch is scheduled.** | Launching [date/time, timezone]. Share your page now so people can follow along. |
| Published only | **[Name]'s page is live. Let's launch it.** | Choose when to join the launch list and invite your first supporters. |

For a published-only startup, make **Launch now** the primary next action and **Choose a date** secondary. The action must update the real launch record and homepage immediately. Once completed, move that step into a compact completed state.

Below the status, show a short checklist with three tasks:

1. **Launch your startup** — completed when launched or scheduled; show the real date/state and relevant edit control.
2. **Invite your first supporters** — editable short post preview, Share on X, Copy post, and Copy page link.
3. **Prepare your launch kit** — actual preview, editing/download controls for Pro, or a compact optional upgrade for Free.

Show one prominent next action at a time. After scheduling/launching, sharing becomes the primary action. Include **I'll do this later** / **Go to dashboard** as normal exits. Do not describe optional sharing as a prerequisite to finishing a launch.

Do not mark “Shared on X” as completed just because someone opened the composer. Track “Composer opened” separately. A founder may select **I've shared it** to mark the checklist item as self-reported, or skip it. That marker is not verified social activity and must not affect rank or rewards.

### 5. Make the X sharing work properly

Use the existing X sharing implementation where sound. Open an editable, prefilled X composer from the founder's explicit click. Include the public FounderTrail product URL, not the dashboard URL, ownership token, checkout URL, or the startup's external website as the main shared link.

Provide a reliable **Copy post** fallback. Encode text/URLs correctly. Keep templates comfortably within the ordinary post-length limit, using the clean short product name rather than a scraped name containing the entire tagline. Do not split legitimate product names arbitrarily at every dash; reuse the existing clean-name field or offer a founder-editable value.

Default template after launching:

> I just launched [Short name] on FounderTrail.
>
> I'd love your feedback. Take a look and follow the page for updates:
> [Public page URL]

Default template for a scheduled launch:

> [Short name] is on FounderTrail. We're launching on [date].
>
> Take a look and follow our progress:
> [Public page URL]

Default template for a published page without a launch:

> [Short name] now has a home on FounderTrail.
>
> Take a look, share your feedback, and follow what we build next:
> [Public page URL]

Let the founder edit the draft. Optionally insert their existing short description through an explicit control. Do not force hashtags, mass mentions, a claim of guaranteed traffic, or a request for reciprocal upvotes. Do not invent FounderTrail's X username; use a configured handle only if one exists.

For launch graphics, implement a dependable sequence: **edit image → download image → copy/edit post → open X → founder attaches the downloaded image and posts**. Explain attachment in one short line. Do not promise that a simple share link uploads the graphic automatically. An OG link preview and an uploaded launch-kit image are different things.

The normal share feature requires no new X OAuth integration, automatic posting, or paid X API service. The founder publishes in X themselves. Verify the text/link composer on desktop and mobile; provide copy/download fallbacks where pop-ups or browser capabilities differ.

Public startup pages must have valid canonical URLs, short titles/descriptions, and working OG/Twitter-card image URLs based on existing infrastructure. All shared public assets must be readable without a session and contain no private information. X controls whether and when a preview renders; do not promise an immediate preview refresh.

### 6. Keep Free useful and Pro visible

Free founders can publish, launch now, schedule, copy their page link, share on X, receive comments, and gain followers.

Pro founders receive the existing editable graphics, editable social drafts, seven-day results summary, and Pro badge. Reuse the actual existing editor and exports rather than creating a decorative preview with non-working controls. Their kit must use the correct live/scheduled wording and date. If the launch date changes, regenerate the default preview without discarding user-written edits silently; offer a refresh action.

For a Free founder, show one compact optional card below the launch/share actions:

**Make your launch ready to share**  
Editable launch graphics, social post drafts, a seven-day results summary, and a Pro badge.  
**Preview launch kit** · **Upgrade to Pro — [actual price] one time**

Keep the agreed price: **$5 for the first 20 eligible startup purchases, then $9**. Reuse authoritative server-side pricing, reservations, checkout, payment verification, and entitlements. Show the real remaining introductory availability; never hardcode a scarcity number. An already-Pro startup sees its tools, not another purchase prompt.

Do not reopen sponsorship, paid links, or paid ranking in this task. Do not gate the basic short Share on X template behind Pro; the paid value is the richer editable kit already promised.

### 7. Improve the homepage immediately

After successful “Publish & launch now,” the startup must be eligible for the current-week homepage list immediately, including to logged-out visitors. Invalidate the relevant cached queries/pages. Do not rely on the founder reloading several times or on a nightly job.

Scheduled launches must appear at their start time even if the founder never returns. Use the existing jobs where appropriate, but derive public eligibility from stored timestamps so a missed job cannot leave a due launch invisible indefinitely. Ensure cache expiry/invalidation supports timely transitions.

When the week has real launches, show the current section and product rows using existing styling. Retain logo, short name, description, 1–3 categories, upvote control, comments count/link, Follow, and eligible Pro badge. Do not restore outbound-click badges or sponsored blocks.

When the week has no launches, **do not lead with the current wide empty container**. Show real **Discover startups** / community-directory content in the main content position. Above it, use only a compact invitation:

> Be among this week's launches. **Launch your startup →**

If there are future scheduled launches, show a compact “Coming up” preview with true dates. Never relabel old directory entries as new launches to fill space. Switching to a weekly view with no launches may show a small truthful empty state, but the default homepage should still be useful.

Route the CTA intelligently: logged-out → sign in and return to launch selection; owner with eligible startups → select a startup or open the only eligible one; owner without one → submission. Never lose the intended destination during authentication.

### 8. Handle the existing nearly 200 startups

Preserve IDs, public URLs, logos, descriptions, categories, original timestamps, votes, comments, follows, click history, visitor history, launch history, paid orders, and Pro entitlements. Do not recreate listings as a shortcut.

Use these management-access rules:

| Existing situation | Required behavior |
| --- | --- |
| Startup already belongs to the signed-in account | Open its dashboard/workspace immediately; no claim step. |
| Original authenticated submitter is reliably recorded, but a separate claim is pending | Associate management access automatically if there is no conflicting owner; preserve the evidence and audit the migration. |
| Legacy listing has a trustworthy original private contact and no owner | Offer a short “Manage this startup” path. Auto-match only when server-verified identity provides reliable current control of that exact stored contact; otherwise send a one-time verification link to that stored contact. |
| Legacy contact missing, inaccessible, or identity ambiguous | Keep a recovery path using existing domain proof or support. Do not make all new founders use it. |
| Existing owner is another account | Do not overwrite ownership; offer the existing access/transfer request route. |

Use the existing internal account ID tied to Google's stable subject identifier. A newly typed contact email is not evidence of ownership. A Gmail/Workspace identity and a Google account using an unrelated third-party mailbox have different email-authority properties; follow Google's guidance cited below. Never allow a user to change the stored legacy contact and then use that changed value to approve their own access.

For a verification-link recovery, use an expiring, single-use token bound to the listing and signed-in claimant. Confirm consumption through an explicit action so an email-security scanner's GET request cannot assign ownership. Do not expose the stored private address publicly. This is account-access recovery, not a new passwordless login system.

Duplicate handling must use a stable product identity and database enforcement. Respect distinct products on shared hosts/domains; do not collapse every product into a registrable-domain match. If the submitter already manages the duplicate, resume its workspace. Otherwise take the appropriate access route above instead of creating a second listing.

Existing published, owned startups without a launch get a prominent dashboard action:

> **Your page is live. Launch it this week.**
> Join the launch list and invite your first supporters.  
> **Launch now** · **Choose a date**

For old submissions waiting only on ordinary admin approval, add a migration that publishes records passing the new automatic checks. Skip drafts, previously rejected/hidden/suspended records, and unresolved conflicting duplicates. Preserve original submission dates and record the actual publication transition. Produce a reconciliation report identifying exceptions and reasons; do not drop them.

Do not automatically launch all historical listings, backdate their launches, or assign every unclaimed page to the administrator. Legacy founders enter a launch when they choose it, unless a genuine launch was already scheduled.

Provide a copyable activation link for each existing startup from admin and a useful in-app destination after sign-in. Do not send bulk emails or DMs as part of implementation. This task supplies the flow to which future outreach can point.

### 9. Make the implementation reliable

- Inspect and change backend authorization and status queries as well as UI labels. Removing the “Claim” button alone does not implement this requirement.
- Use an idempotent submission operation and a transaction for page publication, management association, and chosen launch. Retries/double clicks must not create duplicate listings or launches.
- Revalidate launch timing at commit time. If a selected date becomes invalid, preserve the draft and show a correctable error; do not silently launch now.
- Keep checkout, image generation, emails, and third-party metadata calls outside the critical publication transaction. Their failure must not roll back a successful publication.
- Commit the durable publication before triggering external side effects; reuse an outbox/job mechanism if present. Retry jobs safely without duplicate notifications or reports.
- Server-side authorization must cover edits, launches, uploads, private metrics, orders, and activation-workspace data. Client-supplied owner/account IDs never decide access.
- If the page was committed but the response was lost, a retry must recover the existing outcome and workspace.
- Retain server-side checks against unsafe HTML, uploads, and URLs. Apply bounded submission limits per account with understandable feedback. Google sign-in alone is not proof that every submission is legitimate.
- Keep a report/hide route and admin controls. Hidden/suspended startups must disappear from weekly lists, discovery, and public shares as appropriate without deleting historical data.
- Make the mobile flow usable at 360 px wide; avoid nested scrolling, overflowing action rows, inaccessible radio cards, and hover-only controls. Support keyboard focus, labelled controls, error summaries, and reduced motion. Use the current coral, dark text, rounded panels, and spacing system.
- Do not log contact emails, verification tokens, drafts, or payment secrets in public analytics. Keep operational errors actionable without exposing sensitive data.

### 10. Measure the activation flow

Reuse existing analytics. Record deduplicated, meaningfully named events for:

- Successful publication.
- Launch now completed.
- Future launch scheduled / rescheduled / cancelled.
- Scheduled launch became active.
- Activation workspace viewed.
- Public link copied.
- X composer opened.
- Share completion self-reported.
- Launch image downloaded.
- Pro checkout started and payment confirmed.

Do not interpret a composer open as a published X post, a download as a share, or an outbound click as a new customer.

In the existing admin analytics area, show a compact view of actual weekly launches, future scheduled launches, owned published startups without a launch, and publication-to-launch conversion. Define the cohort/date range and exclude demo/test data. Start with these essentials instead of building a separate analytics platform.

### 11. Acceptance checks

Use the existing test tools and run targeted checks for the changed behavior. Verify the following with realistic local/staging data:

1. A new signed-in founder chooses Launch now, submits once, immediately owns the listing-management record, and has a public page visible while logged out. It appears in the current weekly list without admin action.
2. The scheduled option publishes the page immediately, shows the right local date, and enters the current list only when its stored start arrives.
3. Publish only creates a public page without a launch; the next screen offers working Launch now / Choose a date actions.
4. The default launch choice and submit button agree; draft/back navigation preserves changed selections.
5. Returning to the workspace preserves the actual launch state and optional task progress.
6. A repeated submit, retry, or concurrent request creates one listing and one chosen launch. A user cannot replace another listing's owner by submitting the same URL or editing a contact email.
7. A reliably recorded legacy submitter gets management access without another claim. Ambiguous or conflicting records take recovery instead of being handed to the wrong account.
8. Migration reconciliation confirms that historical votes, comments, follows, click totals, paid entitlements, IDs, and URLs are preserved; only intended status/access changes occur.
9. Share text uses the short name, correct state/date, and correct public link. The composer/copy controls work with non-ASCII names and apostrophes. Opening the composer does not mark a post as published.
10. Pro downloads/edits use real startup content. Free founders can share and launch without buying. A failed/cancelled checkout leaves their published page and launch intact.
11. Empty weekly data shows a compact invitation and real directory content; demo entries and old listings are not presented as launches.
12. Test the week boundary, a future start becoming due, a rescheduled launch, and cache refresh for logged-out visitors. Scheduled launches do not depend on the founder's browser being open.
13. Suspending a startup removes it from public launch/discovery surfaces; routine publication still requires no admin approval.
14. Desktop/mobile layouts and keyboard paths work, and no stale “waiting for review” gate remains in the ordinary new-submission journey.

Run the relevant existing tests, type checks, lint, and build. Broaden testing only if a concrete regression warrants it. Do not claim a live external checkout, real X post, or production migration was tested when only local/mocked checks were run.

### 12. Delivery and rollout

Complete the code, migrations, targeted tests, and concise operational documentation. Follow the repository's established deployment authorization; do not assume this brief authorizes sending marketing messages or manually modifying live records outside the migration process.

Provide:

1. What changed in the founder journey and homepage.
2. The affected routes/components and any environment values actually needed.
3. The exact migration/deployment steps for this repository, with a backup and rollback approach that preserves newly created data.
4. A migration reconciliation summary and exceptions needing recovery.
5. Test/build results, plus screenshots of Review & launch, the launched workspace, the scheduled workspace, mobile, and both populated/empty homepage states.
6. A short list of external configuration blockers only if they truly remain. Do not invent credentials or endpoints, and do not add an X API dependency for ordinary sharing.

Use additive/reversible migrations where possible. Include a dry-run mode for legacy status/access changes and a written report. Never reset the database or delete historical records to simplify this work.

Finish the implementation rather than stopping at a proposal. The intended result is that a new founder can publish and launch in one submission, immediately manage their page, and naturally continue to sharing.

---

## Research notes for the implementer

These sources inform authentication and sharing details; the product flow above is our proposed design, not a claim of proven conversion improvement.

- [Google: Verify the Google ID token on your server](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) — validate authentication server-side; use the stable subject to identify the account. Google distinguishes Gmail/Workspace addresses from third-party email addresses whose current control it cannot authoritatively establish. This matters when matching a legacy listing to a new login.
- [X: How to add the post button to your website](https://help.x.com/en/using-x/add-x-share-button) — sharing opens a prefilled, editable composer; the user then chooses to post. A button click alone does not establish that a post was published.

Reviewed October 1, 2026. Inspect current repository behavior and the current provider documentation when implementing provider-specific code.
