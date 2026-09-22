# Content and product UI follow-up

What migration `017_content_ui_followup` changes, how to run it, and how to edit short
names, categories and pricing afterwards. Pro Launch, sponsorship state, product ids,
slugs, ownership, votes, follows, comments, click history and analytics are untouched.

## 1. Commands

```bash
# rehearse on the isolated branch first
npm run migrate:test

# production window, after the backup/restore gate in MIGRATION_RUNBOOK.md
npm run migrate

# checks
npm test && npm run lint && npm run typecheck && npm run build
```

Migration `017` seeds the 24-category taxonomy, adds the short-name and pricing columns,
archives and clears machine-inferred pricing, and performs the requested one-time category
reset. It records the run in `category_migration_runs`; running it again is a no-op that
leaves manual classification and newly submitted products alone.

## 2. The one-time category reset

* Every product that existed at migration time is archived in `product_category_archive`
  (`version = 'foundertrail-category-v2-reset'`) with its previous primary category, its
  full category list, its provenance and its review flag.
* Those products are then set to **Other** and flagged `category_review_required`, which is
  what the admin "Other / needs classification" filter reads.
* `category_migration_runs` records the target product count and the before/after counts
  per category.

Recovery, which never overwrites a later edit:

```bash
npm run categories:restore              # dry run: prints what would change
npm run categories:restore -- --apply   # restores, in one transaction
```

It only restores products whose `category_provenance` is still the reset version. A product
you have since classified in admin, a founder's own choice, and anything submitted after the
migration are reported as skipped and left exactly as they are.

## 3. Editing a listing in admin

`/admin` → **Products** → **Edit listing** on any row. The panel edits three things:

* **Short name** — the public brand name. The originally submitted name and the slug are
  never rewritten; the panel shows the submitted name underneath for reference. When a
  legacy name looks like it carries its tagline, a suggestion appears with a "Use this"
  button — it is a suggestion only and is never applied on its own. Clearing the field
  falls back to the submitted name.
* **Categories** — one to three, searchable, with removable chips and a live count.
  Selecting **Other** clears the rest; selecting a specific category clears Other.
* **Pricing** — the listed startup's own pricing, not FounderTrail's checkout. Leave it as
  *Not listed* and the public pricing row is omitted entirely. An amount is only available
  for Freemium and Paid, and supplying one requires a currency and a billing basis
  (one-time, monthly, yearly, usage-based; usage-based also needs its unit). Open source is
  a separate checkbox, because open-source products can still charge for hosting.

Two review filters sit in the products toolbar: **Other / needs classification** and
**Name needs review**.

Founders edit the same three fields at `/manage/<slug>`; moderation assigns categories at
approval time. Every writer goes through the same validation, so the limits and Other's
exclusivity cannot differ between surfaces.

## 4. Pricing that existed before the migration

All pricing in the database was machine-inferred (`pricing_provenance =
'foundertrail-public-metadata-v1'`). It is archived in `product_pricing_legacy` and removed
from the public surface; the admin panel shows the archived value so it can be re-entered
if it is correct. Products previously marked `open_source` keep that fact in
`products.is_open_source`. `npm run foundertrail:enrich` can no longer write a category or a
price: with `--apply` it only records proposals for review.

## 5. Legacy names still needing admin review

These published listings still carry their tagline inside the stored name. They are listed
under the admin **Name needs review** filter; the third column is the suggestion the panel
offers, which still needs a person to confirm it.

| Slug | Stored name | Suggested short name |
| --- | --- | --- |
| `5v5-global-one-champion-a-day` | 5v5.global — one champion a day | 5v5.global |
| `agenthill-agents-fight-the-hill-you-buy` | AgentHill — agents fight the hill, you buy the fuel | AgentHill |
| `bidpixel-pixel-wars-bidding-website` | BidPixel — Pixel Wars bidding website | BidPixel |
| `claude-code-vs-grok-war-2-tugwar-lol` | Claude Code vs Grok — War #2 — tugwar.lol | Claude Code vs Grok |
| `daily-outbid-real-traffic-a-dofollow-bac` | Daily Outbid — Real traffic + a dofollow backlink for your product | Daily Outbid |
| `flightbid-fly-your-brand-over-as-many-co` | FlightBid — fly your brand over as many countries as you can | FlightBid |
| `getmehome-lol-help-sam-reach-earth` | GetMeHome.lol — Help Sam reach Earth! | GetMeHome.lol |
| `listingbott-1-for-directory-submission-s` | ListingBott - #1 for directory submission sites! | ListingBott |
| `outbid-tv-take-the-air` | Outbid.tv — Take the air | Outbid.tv |
| `outgrid-claim-the-grid` | Outgrid \| Claim the grid | Outgrid |
| `overbooked-every-seat-is-for-sale` | Overbooked — every seat is for sale | Overbooked |
| `promobid-win-the-top-spot-get-posted` | PromoBid — win the top spot, get posted | PromoBid |
| `saas-town-a-gamified-3d-directory-for-sa` | SaaS Town - A gamified 3D directory for SaaS startups | SaaS Town |
| `skybid-claim-your-spot-in-the-sky` | SkyBid — Claim your spot in the sky | SkyBid |
| `throneit-live-pay-to-rank-board` | ThroneIt \| Live pay-to-rank board | ThroneIt |
| `yourhour` | YourHour - Pay less, Get more. #1 product gets featured on the homepage. | YourHour |
| `cut-the-line-the-public-queue` | cut the line — The public queue | cut the line |
| `getscreenplot-com-the-internet-x27-s-bil` | getscreenplot.com — The internet&#x27;s billboard | getscreenplot.com |
| `hill-bid-own-the-hill-until-it-melts` | hill.bid — Own the hill. Until it melts. | hill.bid |
| `look-i-m-rich-the-world-s-most-expensive` | look I'm rich — the world's most expensive leaderboard | look I'm rich |
| `topwar-lol-outbid-your-way-to-1-pay-to-r` | topwar.lol — Outbid Your Way to #1 \| Pay-to-Rank Leaderboard | topwar.lol |

`getscreenplot.com — The internet&#x27;s billboard` also shows how stored HTML entities are
now decoded for display and sharing; the stored value itself is left alone.
