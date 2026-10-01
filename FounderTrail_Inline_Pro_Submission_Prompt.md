# FounderTrail — offer Pro inside the final submission step

Implement an optional Pro Launch offer inside the existing startup submission flow. Founders should understand and select Pro without visiting the Pricing page. Complete the implementation and verification, not just a plan.

First read repository instructions and inspect the submission wizard, draft persistence, Pro launch-kit components, pricing/reservation service, Dodo checkout, webhooks, entitlements, moderation, and refunds. Reuse the existing system and design language. Keep this change focused; do not rebuild billing or the launch-kit editor.

## 1. Placement and design

In step 3, “Founder and review”, insert one compact Pro card **below the startup preview and above the required submission-authority checkbox**. Keep the current three-step wizard, founder fields, optional newsletter consent, Back, and Save draft actions.

Match FounderTrail's white surfaces, dark navy text, coral accent, rounded corners, and restrained borders. Use a subtle coral-tinted card, readable type, and generous but compact spacing. On desktop, place the price to the right and the four benefits in two columns; stack naturally on mobile. No modal on entry, extra mandatory step, duplicate pricing table, or oversized sales section.

Use this copy:

- Eyebrow: **OPTIONAL · PRO LAUNCH**
- Heading: **Give your launch a polished start.**
- Description: **Turn your startup details into a launch kit you can make your own.**
- Price: **$5 one-time / startup**, switching to **$9** when required by the existing pricing service.
- Introductory note: **First 20 startup purchases: $5. Then $9. No subscription.** Adapt once the introductory offer has ended.

Show four benefits with small consistent icons:

1. **Editable launch images** — Personalize and download.
2. **Ready-to-edit post drafts** — Make them sound like you.
3. **Seven-day launch report** — See your launch activity clearly.
4. **A Pro badge on your startup** — Shows your Pro membership.

Keep the badge's existing meaning: a paid plan, not identity verification or guaranteed quality. Do not add ranking boosts, backlinks, sponsorships, traffic guarantees, or priority approval.

## 2. A personalized preview

Add an accessible inline disclosure labelled **“Preview {short startup name}’s launch kit”**. Opening it must keep all form inputs and scroll context intact.

- Reuse the actual launch-kit templates and rendering components to show a representative graphic using the current draft's logo, short name, description, and existing template styling.
- Include one relevant social-post draft generated from the current draft using the existing mechanism. Do not invent claims, revenue, testimonials, or launch status.
- Label the content **Preview**. Keep paid editing/download actions protected by the existing entitlement checks; this is a sample, not a free export endpoint.
- Update the preview after founders edit earlier steps. Handle long names, missing/broken logos, Unicode, and empty optional fields gracefully.
- Load heavier preview code when expanded. Do not add a new AI provider, paid generation dependency, or separate editor.
- Preview failures must leave both free submission and the Pro choice usable. Give a short retry message.

The preview should make the benefit tangible while staying compact. Do not use hardcoded sample companies in production or display invented report metrics.

## 3. One explicit choice and a clear action

At the bottom of the card, add an initially unchecked native checkbox:

**Add Pro Launch** — **{current price} once**

Keep this choice separate from newsletter consent and the required submission-authority confirmation. Preserve the user's explicit selection across wizard navigation and draft restoration; never silently preselect Pro on a new submission.

With Pro unchecked:

- Summary: **Free submission**
- Helper: **You can upgrade later.**
- Primary button: **Submit for review**
- Use the normal free submission flow.

With Pro selected:

- Summary: **Pro Launch · {current price} one-time**
- Helper: **Any applicable taxes appear at checkout.**
- Primary button: **Submit & go to checkout**
- Supporting text: **We’ll save your submission before opening secure checkout. All startups are reviewed.**

Back and Save draft never initiate checkout or reserve an introductory purchase. Use one primary submission button, accessible loading/error states, and normal keyboard/focus behavior. Avoid horizontal overflow at small mobile widths.

## 4. Submission must survive checkout

Validate required fields and authority confirmation before initiating either flow. On a valid Pro submission:

1. Persist the startup and its assets through the existing submission service, in the normal pending-review state. Associate it with the authenticated submitter according to existing ownership rules.
2. Once persistence succeeds, create or reuse a Pro order/checkout tied to that startup and authorized account. Reuse the existing Dodo integration and reservation logic.
3. Send the founder to checkout. Returning from checkout leads to a clear submission/payment status screen or the existing startup dashboard.

Submission and payment are separate states. If checkout creation fails, the payment is cancelled, or the founder closes the browser, retain the pending submission on the free plan. Show **“Your startup was submitted for review. Pro hasn’t been activated yet.”** with Retry Pro checkout and Continue free actions when appropriate.

If payment status is still unknown, show **“Your submission is saved. We’re confirming your payment.”** Reconcile the existing payment before offering a new charge. Never treat a cancelled browser redirect as proof that payment failed.

Prevent duplicate submissions, orders, charges, and reservations from double-clicks, refreshes, navigation, or retries. A duplicate URL must follow the existing claim/manage flow; Pro must not bypass it. Revalidate authorization on the server, using trusted account/submission ownership rather than the editable contact email. Already-Pro startups must not be offered another purchase.

## 5. Reuse authoritative pricing and payment confirmation

Use the same price, purchase count, reservation rules, and entitlement service as the Pricing page and existing upgrade page. No separate inline-offer counter or client-supplied price.

- A card impression, preview, checkbox selection, or draft save does not reserve a $5 purchase. Reserve only when checkout actually starts.
- Keep completed purchases distinct from temporary holds. Never hardcode the screenshot's “19 available” or count reservations as sales. Exclude test purchases from live availability.
- Revalidate price when starting checkout. If the price changes, clearly show the new amount and obtain confirmation before continuing. Respect valid checkout quotes and their existing expiration policy.
- Keep existing reservation expiry, late-payment resolution, refund accounting, and one-Pro-upgrade-per-startup safeguards. Reuse the established handling of temporary holds instead of inventing competing pricing behavior.
- Activate Pro only after trusted server-side payment confirmation. Verify Dodo webhook signatures and process retries/out-of-order events safely using durable idempotency. A success query parameter alone must never grant Pro.
- Reuse existing verified refund events to update payment/entitlement state; a later payment-success event must not undo a completed refund.

If payment configuration is missing, keep free submission working and show a concise Pro-unavailable state. Do not expose configuration names or secrets in the founder UI.

## 6. Paid submissions still require approval

Extend the existing checkout eligibility narrowly so an authorized founder can buy Pro for their newly saved pending-review submission. Payment must never publish it or mark it approved.

Confirmed payment can unlock the existing private launch-kit tools while review is pending. The public Pro badge becomes visible when the startup is published. Keep the seven-day report attached to the actual launch window; submission or purchase must not start that report early.

Because payment can now happen before approval, implement an idempotent full-refund path when the initial submission is rejected, using the existing Dodo refund integration. Handle rejection before a delayed payment webhook as well as rejection after payment. Record refund pending/completed/failed states, retry failures safely, and expose unresolved cases to admin. Prevent new checkouts for rejected submissions. Do not mark a refund complete until the provider confirms it.

Show a concise policy before checkout: **“All submissions are reviewed. If your startup is rejected, we’ll refund your Pro purchase.”** Add this promise only together with the working refund handling. If credentials prevent live verification, test with the supported sandbox/mocks and document the production configuration/check required; do not claim a real refund was tested.

## 7. Scope, measurement, and verification

Keep the Pricing page and existing dashboard upgrade flow working. Preserve startup IDs, slugs, claims, moderation, categories, pricing information, historical votes/clicks, comments, follows, purchases, and entitlements. Do not rerun the earlier category reset or change email templates. No production payments, emails, or deployment as part of testing.

Use existing analytics for offer viewed, preview opened, Pro selected, checkout started, and confirmed purchase, with submission-flow attribution and sensible deduplication. Record purchases from trusted payment processing, not a browser return. Do not send form content or private contact information to analytics, and do not install another analytics SDK.

Run focused checks for:

- Free submission and Pro submission, including required-field errors.
- Navigation/draft restoration and preservation of the explicit choice.
- Checkout cancellation/failure without losing the submission.
- Duplicate clicks, delayed payment confirmation, and returning later.
- Correct price at the introductory boundary and consistent counters across entry points.
- Payment authorization, already-Pro handling, and invalid webhook signatures.
- Rejection/refund races, duplicate events, and failed-refund recovery.
- Personalized preview rendering and mobile/keyboard usability.

Finish with a short report of what changed, checks performed, any exact migration/configuration steps, and anything unverified. Make the result ready to review locally; do not stop at a design proposal.

Official implementation references—check against the installed SDK and existing integration:

- https://docs.dodopayments.com/developer-resources/checkout-session
- https://docs.dodopayments.com/developer-resources/webhooks
