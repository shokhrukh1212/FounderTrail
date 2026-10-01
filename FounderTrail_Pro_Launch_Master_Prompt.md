# FounderTrail — Free + Pro Launch implementation

Paste this entire file into Codex in the existing FounderTrail repository. Implement the changes; do not stop at a proposal.

## 1. Latest product decision — this overrides earlier monetization prompts

FounderTrail is already built and being tested locally. It has real startup listings, founder contacts, claims, launches, votes, follows, comments, updates, and historical analytics. Extend that implementation and its existing design system.

We are simplifying monetization to two options: **Free** and **Pro Launch**.

- Pro costs **$5 USD once for each of the first 20 qualifying startup purchases**, then **$9 USD once**.
- One purchase upgrades one startup. It is not an account-wide plan and not a subscription.
- All Pro startups receive the same benefits, whether they paid $5 or $9.
- Benefits: a professional editable launch-image studio, editable social post text, a clear seven-day results summary, and a visible green **Pro** badge.
- There is **no Founding 20 badge**, founding-supporter page, or special permanent status exclusive to the introductory buyers.
- **Pause all advertising and sponsorship sales and displays in this release.** This includes the earlier suggested 24-hour placement inside Pro. Pro does not buy homepage placement, promoted rows, a featured spot, priority ranking, faster review, a launch date, extra votes, or traffic.
- No paid backlinks, dofollow offers, DR sales pitch, badge-for-backlink exchange, or link changes based on payment.
- No Stripe revenue/MRR verification in this release.

The product should sell useful launch tools and understandable reports. Every promised benefit must work end to end. No dummy editor, fake download, fake scarcity, placeholder report, or unimplemented upsell.

## 2. Inspect the repository and protect existing work

Read applicable AGENTS.md instructions, project documentation, package versions, database migrations, tests, authentication, billing integration, analytics, storage, and existing sponsorship code. Reuse working implementations. These instructions specify behavior, not mandatory database table names or a replacement framework.

Use a working branch if appropriate. Preserve unrelated changes. Take a local backup or provide an executable backup procedure before migrations. Use additive migrations and idempotent backfills. Do not seed or alter production data.

Preserve IDs, slugs, URLs, ownership, private founder contacts, listing content, assets, category/pricing corrections, approval states, historical votes, clicks, comments, followers, visitor metrics, launches, and audit/payment records. Record a before/after reconciliation of counts and historical totals. The screenshots contain test data; do not hard-code their numbers or treat seeded purchases as revenue.

Audit claim and Google sign-in flows. Existing founders must be able to claim/manage the same startup before upgrading, without creating a duplicate or resetting its metrics. Fix concrete blockers found in these required flows, but do not expand this task into a new outreach platform or auth rewrite.

## 3. Remove the old sponsorship experience cleanly

The supplied screenshots show an Advertise nav item, a large Featured sponsors section, $20/$60 pricing, a public availability calendar, and a Promote this startup checkout. Replace this user journey with Free + Pro.

- Replace **Advertise** in the header with **Pricing**.
- Remove the Featured sponsors section, sponsored cards, inline promoted rows, sponsor cards on startup pages, and public sponsor-calendar UI from the new release.
- Replace dashboard promotion CTAs with **Upgrade to Pro** for eligible Free startups and **Open launch kit** for Pro startups.
- Retire the old standalone sponsorship purchase routes on the server as well as in the UI. Old public advertising information URLs can redirect to Pricing. Startup-specific promotion URLs can route authorized owners to that startup's Pro page. Never activate anything from a GET redirect.
- Do not create another banner advertisement or a 24-hour promotion package under the Pro name.
- Keep reusable billing, analytics, campaign records, and historical reporting code. Use a clearly named disabled feature flag/module boundary; avoid large commented-out source blocks and avoid destroying tables.
- Before disabling delivery, distinguish sandbox/demo campaigns from real paid obligations. If real obligations exist, preserve their records and provide a grandfathered fulfillment or refund resolution path in the handoff. Do not silently remove a service somebody already bought. Complete the rest of the work even if an operator decision is needed for a real historical purchase.
- Keep legacy webhook processing needed to reconcile prior payments/refunds. New Pro purchases have separate product IDs and order types so sponsor purchases cannot grant Pro accidentally.

## 4. Information architecture and homepage

Keep FounderTrail's existing logo, white background, dark typography, and coral primary actions. Improve spacing, alignment, responsiveness, and wording without starting a rebrand.

Suggested header: logo; Discover; Updates; Pricing; Submit startup; account menu. Use a clean mobile menu instead of overflowing links.

Homepage:

1. A compact hero using the existing heading: **Launch your startup. Find your first supporters.**
2. Supporting copy: **Share what you're building, collect feedback, and keep your supporters up to date. Discover new startups and follow their progress.**
3. Actions: **Submit your startup — free** and **Explore startups**.
4. **Startups launching this week**, with its existing functional tabs and a compact empty state.
5. The actual community directory immediately afterward, with clear sorting, category filters, and preserved engagement.

Remove the large blank sponsor area and divider/spacing remnants. Make real listings visible without scrolling through promotional content. Do not add a large Pro sales section between the hero and startup lists. Pricing in the nav and contextual dashboard CTAs are sufficient.

Pro must never change organic order or the established launch eligibility rules. Keep browsing public and keep existing free participation features available.

## 5. Green Pro badge

Build one reusable component and use the authoritative startup entitlement to render it everywhere.

- A compact green pill containing a simple check icon and the visible word **Pro**. Use a readable dark green on a pale green background; reserve coral for primary actions.
- Display beside the startup name on directory rows, weekly launch rows, search results where appropriate, its detail page, and the owner dashboard.
- Give every active Pro startup this badge, including buyers after the first 20.
- Tooltip/help text: **Pro startup · Includes FounderTrail's launch kit and results summary.** Accessible label: **Pro plan**.
- Do not call it Verified, identity verified, revenue verified, approved quality, or recommended. Payment is not proof of any of those things. If an ownership-verification badge already exists, preserve its separate meaning and presentation.
- Do not make the icon alone communicate paid status. Tooltip content must be accessible on keyboard and touch as well as hover.
- The badge belongs to the startup. Buying Pro for one startup must not give the founder a verified-account badge or upgrade their other products.
- Pro badges disappear when the corresponding entitlement is revoked/refunded according to the billing policy. They must not depend on client-supplied flags.

## 6. Pricing page — two clear choices

Create a polished Pricing page with a compact introduction, two aligned plan cards, a real launch-kit preview, and a short FAQ. Use readable typography and sensible content width, not the oversized technical advertising page shown in the screenshots.

Heading: **A free home for your startup. Better launch tools with Pro.**

Supporting copy: **Create your page for free. Upgrade for editable launch graphics, ready-to-share post drafts, a clear results summary, and a Pro badge.**

### Free card

Price: **Free**

List the features already delivered by the app: startup page, normal launch scheduling, community upvotes/discussion/follows, founder updates, and existing basic statistics. Keep existing screenshots and ordinary website links free. Do not fabricate queues or take existing features away to make Pro look attractive.

CTA: **Submit for free**; adapt to **Manage my startups** for an appropriate signed-in owner.

### Pro Launch card

While introductory inventory is available:

- **$5** with **one-time / per startup** immediately beside it.
- **First 20 startup purchases: $5. Then $9.**
- A database-derived availability message such as **12 of 20 introductory upgrades available**. Account for checkout holds truthfully; do not describe held places as completed sales.

After the introductory allocation is exhausted:

- **$9** with **one-time / per startup**.
- **The $5 introductory offer has ended.**
- No fake strike-through price, resetting countdown, or fabricated sold counter.

Benefits:

1. **Editable launch graphics** — professional layouts, ready to download.
2. **Editable social posts** — adapt and copy drafts for your launch.
3. **Seven-day results summary** — understand the activity around your startup.
4. **Pro badge** — visible beside your startup's name.

Use **Preview launch kit** as a secondary action. Avoid a “Most popular” claim before there is evidence.

FAQ must clarify: a single startup is upgraded; no renewal; existing listings keep their history; the badge identifies Pro status; launch-kit tools remain available while the service operates; one seven-day reporting window is included; placement/ranking/review treatment are unchanged. Show taxes/checkout total accurately. Do not promise SEO results, customers, indexing, or future features.

Do not put internal implementation terms in sales copy. The current screenshots expose database constraints, webhook behavior, UTC internals, rel attributes, and provider configuration. Move operational explanations into admin/docs. A customer needs the price, benefits, and clear next steps.

## 7. Purchase and activation journey

Use the existing Google-only sign-in and Dodo Payments integration. Do not introduce another auth or payment provider without an actual blocker.

Owner of an approved startup:

1. Opens Pricing or **Upgrade to Pro** in the startup dashboard.
2. Selects an owned approved startup if they manage several. A contextual dashboard link preselects it.
3. Sees the startup's logo/name, exact benefits, a preview, current price, one-time terms, and **Unlock Pro for $5** or **Unlock Pro for $9**.
4. Completes hosted checkout.
5. Sees **Confirming your payment** while awaiting reliable payment confirmation.
6. Once verified, sees **[Startup name] is now Pro** with **Create launch image**, **Write launch post**, and **View results**.

Preserve safe return destinations through Google sign-in. Confirm authorization on the server.

Existing unclaimed startup: route through claiming first. New founder: offer a free submission and let them upgrade after approval. A rejected/pending submission must not be charged for Pro. An active Pro startup cannot buy the same upgrade twice. A returning owner goes to their tools, not another checkout.

Keep payment confirmation independent from slow image generation and reporting. The entitlement should activate reliably; assets can be created when the user opens the studio. Provide retry/error states without requiring repurchase.

Missing billing setup: browsing, free submission, and previews work; checkout is visibly unavailable with a brief customer-friendly message. Admin receives exact missing-setting diagnostics. Never display an enabled payment CTA that cannot work.

## 8. Correct introductory inventory and billing

This is a real payment boundary, so implement meaningful safeguards rather than a front-end counter.

- Amounts are server-owned integers in cents: 500 and 900 USD. Quantity is one; plan/startup/provider SKU combinations are validated server-side.
- Keep a durable order, quoted price, payment environment, startup, purchaser, provider checkout/payment IDs, introductory reservation/allocation, status, and entitlement audit history.
- A qualifying introductory purchase is a real production payment for a distinct eligible startup. Test, demo, complimentary admin grants, failed/abandoned checkouts, duplicate webhooks, and old sponsorship orders do not consume the live allocation.
- Use atomic database transactions/constraints to ensure no more than 20 introductory allocations are completed or safely reserved concurrently. Reserve at checkout with a documented expiry aligned with the provider's real ability to expire/cancel payment sessions. A second checkout for the same startup should reuse or resolve the existing order.
- Never silently change a quoted $5 checkout to $9. If the last introductory places become unavailable, explain this and require acceptance of the newly quoted price before creating a different checkout.
- If all unsold places are temporarily held, show that they are temporarily reserved, not that twenty people have bought. Release abandoned holds safely. Do not blindly release a hold while its checkout can still complete without handling that race.
- A confirmed introductory allocation is not reopened by a later refund. Keep the offer finite and explain this rule in the operator runbook; do not count refunded orders as active customers or net revenue. A startup cannot repeatedly reclaim the introductory discount.
- Handle delayed successful payments after an expired/reallocated hold explicitly. Do not oversell, charge the price difference, or silently keep money without access. Reconcile provider state and either safely fulfill within capacity or record/execute the supported refund path with visible owner/admin status.
- Verify raw-body webhook signatures using the installed official SDK and current documented headers/events. Do not trust the success URL, browser state, unsigned webhook, or metadata alone as proof of payment.
- Verify the expected merchant/environment, product, amount/currency and tax semantics, order identity, and ownership. Persist event IDs and make processing idempotent across instances/restarts. Handle duplicate and out-of-order success/refund/dispute events.
- Commit the event and entitlement transaction or durably enqueue it before acknowledging success. Do not rely on an unawaited serverless background promise.
- Full refunds revoke Pro tools/badge while preserving the free startup and all history. Open disputes should follow a documented reversible suspension policy; won/lost disputes must reconcile correctly. A late success event must not reactivate an already refunded purchase.
- Use separate test/live inventories and product IDs. Keep the live promotion count zero until actual qualifying purchases exist. Local fixtures must be visibly labeled and isolated.

Do not reset early-bird availability automatically on deploy, seed, cleanup, or restart. Keep admin grant/revoke actions distinct from purchases and require an audit reason.

## 9. Launch Studio — the main paid benefit

Build a small, polished editor, not a general-purpose design application. Reuse the project's rendering/storage stack and select the simplest reliable export method. Paid AI APIs are not required; use high-quality layouts and deterministic, editable copy by default.

Dashboard navigation for an owned startup: existing overview/settings plus **Launch kit** and **Results**. A Free owner can see an honest sample/preview and the upgrade option. Keep their existing basic analytics accessible.

### Image editor

Desktop: a narrow controls panel beside a large live preview. Mobile: preview first, grouped controls beneath, and accessible Save/Download actions. Do not shrink the entire desktop editor onto a phone.

Provide two finished layouts:

1. **Product spotlight** — startup logo, name, headline/tagline, an optional screenshot, and a subtle URL/FounderTrail attribution.
2. **Minimal announcement** — strong typography, logo, editable announcement and CTA, with generous spacing.

Support **1200 × 630** landscape and **1080 × 1080** square exports. Recompose each format intentionally rather than stretching the landscape layout into a square.

Editable fields:

- Startup display name and announcement headline.
- Tagline/supporting line and CTA text.
- The visible public URL, validated for format.
- Logo and optional screenshot from approved assets or validated new uploads.
- Screenshot fit/crop using a simple control.
- An accessible preset accent palette and light/dark design theme.
- Template and aspect ratio.

All meaningful text rendered inside the image must be editable before export. Editing the launch-kit draft must not silently modify the public startup listing. Save a separate per-startup draft; preserve edits across navigation/reload; show Saving/Saved/Error; provide an explicit Reset action with confirmation.

Use sensible field limits, wrapping and font sizing with a minimum readable size. Prevent overflow and illegible tiny type. Show an actionable error if content will not fit. Long startup names, non-Latin text, transparent logos, missing screenshots, and broken remote assets must have deliberate layouts/fallbacks. Do not silently truncate important words in an export.

Export requirements:

- **Download PNG** produces a real image file at the promised dimensions, with a sensible filename such as startup-name-launch-landscape.png.
- The downloaded image matches the preview's content, typography, crop, spacing, and colors.
- Load/decode images and fonts before export. Handle missing fonts, cross-origin image restrictions, slow assets, and rendering failures visibly.
- Use controlled stored assets where possible. Any remote asset fetch/proxy must validate hosts/redirects, block private/internal targets, limit size/time, and validate/decode the image. Do not create an open proxy.
- Sanitize user text and image uploads; no arbitrary HTML/SVG execution or unsanitized markup in renderers.
- Provide useful Downloading/Retry states; retain user edits on failure.
- Use licensed, bundled or properly hosted fonts. Do not introduce a paid image-generation dependency.
- Keep the branding tasteful. No fake awards, verified-revenue claims, traffic counters, stock testimonials, or obligation to add a backlink to the founder's site.

A canvas export does not preserve editable text layers. Be honest: **Edit and save your design here; download it as a PNG.** Reopening the stored draft must restore editable fields. Do not promise an editable Photoshop/Figma file.

### Social post editor

Provide two useful starting formats: **Short post** and **LinkedIn post**. Both are plain editable text, generated from actual supplied product facts. Include the startup's canonical FounderTrail page URL by default, with a safe, editable public destination if the owner prefers their website.

Use specific information: product name, who it helps, the problem it addresses, and one clear invitation to try it or share feedback. Omit missing information instead of inventing claims. Do not fabricate revenue, customers, launch success, time saved, rankings, or urgency.

Respect launch state: an upcoming startup should say it is preparing to launch; a live launch may say it has launched; an existing listing without a scheduled launch should use neutral “Meet [name]” wording.

Provide a live character count and relevant length guidance, Copy text with reliable success/failure feedback, Download .txt, Save draft, and an explicit Regenerate/reset action that never overwrites edits without confirmation. Store independent drafts for the two formats. Add an editable suggested alt-text field for the exported image. Do not automatically post to any external account.

The image and text tools must feel like one launch kit: consistent product data, a clear checklist, immediate preview, and direct download/copy actions. Limit customization to what improves the result; avoid layers, drag-and-drop canvases, and endless settings.

## 10. A clear, truthful results summary

Reuse existing event tracking. Add only instrumentation required for the promised report. Keep old aggregate totals untouched and do not invent timestamps for historical data.

Each Pro purchase includes one **seven-day summary**:

- If an eligible future ordinary launch is scheduled when Pro activates, use its actual launch start as the anchor.
- If no eligible future launch exists, use Pro activation time. Describe it as the first seven days after upgrading, not as an advertising campaign.
- Persist the anchor and half-open interval [start, start + 7 days). Show dates/timezone clearly. Lock it once tracking starts; do not silently restart the report or duplicate it when the founder changes a launch date.
- Before a future anchor begins, show “Your summary starts on [date]”. During the window show “In progress”; afterward show “Complete”. Paid launch-kit access works immediately regardless of the report's start date.
- Existing launches already in progress or historical launches do not receive invented retroactive data. Show the coverage actually available.

Report content:

1. Startup identity, report period, coverage status, and last updated time.
2. Recorded startup-page views, if reliable instrumentation exists.
3. Outbound website clicks during the interval.
4. Upvotes added during the interval, correctly accounting for vote removals; label net change when reporting net values.
5. Followers added during the interval, with equivalent honest handling of unfollows.
6. New public comments during the interval, excluding hidden/deleted items as appropriate to existing moderation semantics.
7. A simple daily activity chart with an accessible tabular alternative.
8. A concise factual sentence, for example: “Between [dates], your startup recorded 18 page views, 6 website clicks and 2 new followers.” These are fixture numbers only, never production defaults.

Use precise metric names. Do not call visitor-days unique people, clicks customers, page views impressions, or community activity conversions. These are observed events around the startup; do not claim Pro caused them. Avoid CTR unless the numerator and denominator measure a defined matching exposure/click journey.

Zero is valid when tracking worked. Missing instrumentation or an unavailable period must say **Not available** with a short explanation, not zero. If only lifetime counters exist, collect prospective events/snapshots and show coverage beginning when that starts; do not fabricate a seven-day breakdown from all-time totals. Backfills must preserve the historical baseline without counting it as fresh Pro activity.

Provide the dashboard report and a polished **Download summary PDF** or reliable print-to-PDF layout with actual tested output. Keep the completed summary accessible afterward. PDF/private downloads and any report API require owner/admin authorization; do not make the metrics public by default.

Finalize using a durable existing scheduler/job or a reliable on-read calculation over persisted timestamps; no in-memory timer. The dashboard is the required delivery channel. Reuse a configured transactional email provider for an optional “Your summary is ready” notification with idempotent delivery, but do not add a new marketing email system or make email setup a blocker for accessing the report. Never email real founders from tests or preview environments.

## 11. Professional interface requirements

The screenshots provide the existing visual direction. Fix their specific weaknesses: oversized sponsorship content, repeated explanatory paragraphs, exposed code/operational terms, wide unused areas, and weak separation between product preview and checkout controls.

- Use a consistent page-width system, typography scale, aligned card padding, and modest corner radii/shadows.
- Keep directory rows compact; the Pro badge should not change row height or displace vote/follow actions.
- Pricing cards should fit together cleanly on desktop and stack naturally on mobile.
- Upgrade confirmation should contain the real selected startup and real output previews, rather than generic “approved startup identity” text.
- Use one primary action per step. Make price, per-startup scope and one-time billing obvious.
- Keep the Pro studio rich enough to be useful, but use grouped fields rather than technical settings.
- Explain results in plain language. Put method details behind a small help affordance, not inside every metric card.
- Implement complete loading, empty, no-access, payment-pending, payment-failed, missing-configuration, export-failed, report-in-progress, refunded, and success states.
- Support keyboard use, visible focus, accessible labels, screen-reader announcements, adequate contrast, touch targets, and reduced motion. Do not rely only on green/coral to convey a state.
- Verify narrow mobile screens and long content. No horizontal page overflow, cropped buttons, or text hidden behind sticky controls.

## 12. Admin and setup documentation

Keep existing moderation, ownership claims, categories/pricing review, founder contact protection, and historical reconciliation tools working.

Add a focused Pro operations area showing:

- live introductory allocation: completed, reserved, available;
- production and test records in clearly separate views;
- Pro startups, paid price, currency, payment status, purchase date and provider IDs;
- entitlements and refund/dispute state;
- stuck payment confirmations and failed exports/report jobs when applicable;
- upcoming/in-progress/completed seven-day summaries;
- billing/configuration health without revealing secret values;
- audited grant/revoke and safe reconciliation/retry actions.

Do not label one-time sales as MRR. Show gross receipts, refunds and net figures with definitions if the admin exposes revenue. Do not expose stored founder contacts to other founders.

Create/update .env.example and a short setup/runbook document using the variable names actually implemented. Explain exactly where the operator obtains each Dodo test/live API key, webhook signing secret and $5/$9 product ID; exact webhook/callback URLs; tax configuration assumptions; storage/font/export setup; report scheduler settings if needed; optional email settings; and local verification commands. Keep existing Google auth setup intact and document changes only if necessary. No secrets in code, screenshots or logs.

Use the current merchant approval/configuration already present. Do not misdescribe the product to the payment provider. If a required provider setting is unavailable, finish all local implementation and clearly identify the remaining operator setup. Do not pretend a mock payment was a real live transaction.

## 13. Focused verification and acceptance criteria

Run the project's required lint/type checks/build and meaningful existing tests. Add tests for real risks introduced here, especially money, access control, data preservation and exports. Do not write trivial tests that only repeat labels.

Required checks:

1. Historical startups, URLs, claims, votes, clicks, comments and followers survive migrations unchanged.
2. Public browsing/free submission still work. An existing founder claims the same startup and can upgrade it.
3. No new sponsor checkout or promoted placement is exposed in the new release. Existing paid obligations are identified and handled explicitly.
4. Introductory pricing works from purchase 1 through 20; the next qualifying purchase is $9. A concurrency test near the limit cannot oversell the $5 allocation.
5. Test purchases, grants, failed checkout, duplicate/out-of-order webhooks and refunds follow the documented counter rules. Client price or entitlement tampering fails.
6. Verified success activates exactly one entitlement. Reloading/visiting a success URL alone does not. Refund/dispute transitions cannot be undone by a late stale event.
7. Pro is enforced server-side for tools/private reports, and startup A's owner cannot access startup B's files or orders.
8. The green Pro badge appears consistently for both $5 and $9 buyers and never says Verified.
9. Editing and saving image text/assets survives reload without editing the public listing. Both layouts export actual PNGs at both required sizes.
10. Open the exported PNGs, not just the DOM preview. Inspect normal content, long names, non-Latin text, missing screenshots, transparent logos, font loading and asset-failure cases. Fix clipping, blank exports and preview/export differences.
11. Social text edits persist, copy/download works, and regenerate preserves changes unless confirmed. No external posting occurs.
12. Seven-day boundaries and launch/upgrade anchors behave correctly. Historical aggregates are not new activity. Zero and unavailable data are distinct. The PDF/print export has readable complete content.
13. Visually inspect homepage, Pricing, upgrade, success, Launch Studio and Results at approximately 390px mobile, 768px tablet and 1440px desktop. Capture representative screenshots. Check actual mobile downloads and keyboard focus where the environment permits.

Use realistic local fixtures and sandbox payments. Do not send real emails, charge real cards, delete provider products, deploy or touch production data as part of this implementation task.

## 14. Finish and hand off

Complete the implementation within the existing repository. Make routine implementation decisions and proceed; do not repeatedly ask about details settled in this brief. If something is truly blocked, complete independent work and report the precise blocker.

Final handoff must include:

- A short explanation of the finished Free + Pro journey.
- Files/migrations changed and the data-preservation reconciliation.
- Checks that passed, checks that could not run, and any remaining setup.
- Screenshots plus real sample downloaded launch images and a results-summary export.
- Exact operator setup steps for local testing and production configuration.
- The introductory-inventory/refund policy, disabled sponsorship behavior, and any old paid obligations requiring resolution.

Do not declare completion because a button or mock exists. Completion means a sandbox buyer can upgrade their approved startup, receive its Pro badge, edit/save/export a professional launch kit, and view/download a truthful seven-day summary.

## Official implementation references

Checked on 22 September 2026. Use documentation matching the installed SDK/framework versions and verify any provider-specific details while implementing.

- Dodo hosted checkout: https://docs.dodopayments.com/developer-resources/checkout-session
- Dodo webhooks/signatures/events: https://docs.dodopayments.com/developer-resources/webhooks
- Browser PNG export: https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
- Font readiness for export: https://developer.mozilla.org/en-US/docs/Web/API/Document/fonts

These references support implementation details. They do not override the product decisions at the top of this prompt.
