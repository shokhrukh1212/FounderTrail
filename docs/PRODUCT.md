# BidIndex product brief

## Purpose

BidIndex is the live, verified discovery platform for bidding products. It helps visitors find pay-to-rank directories, attention marketplaces, bidding experiments, and adjacent products while distinguishing community interest from technically verified activity.

## Users and value

- Visitors discover launches, compare traction, upvote products, and follow founder updates.
- Founders submit products for free, maintain a product page, publish updates, receive tracked outbound traffic, and optionally install a partner integration.
- Administrators moderate submissions and curate metrics that have a public source.

The core value is honest provenance: every displayed metric says whether it is verified live, verified directly by BidIndex, publicly sourced, founder reported, or unavailable.

## MVP scope

- Product discovery, search, launch filters, organic rankings, and metric-specific leaderboards.
- Product pages with overview, media, live metrics, founder updates, and integration information.
- Pending product submissions with lightweight owner links and admin moderation.
- Anonymous unique upvotes and safe tracked outbound redirects.
- Partner badges, domain ownership verification, privacy-conscious visitor events, and signed server events.
- Development-only demo data that is visibly labelled.

## Intentionally excluded

Forums, replies, direct messages, followers, collections, reviews, awards, newsletters, recommendations, native provider integrations, advanced charts, mobile apps, browser extensions, scraping at scale, and paid organic ranking are not part of this MVP.

## Verification terminology

- **Verified live**: received through an authenticated BidIndex partner integration.
- **Verified by BidIndex**: measured directly by BidIndex, such as an eligible outbound redirect.
- **Publicly sourced**: copied from a public source URL by an administrator.
- **Founder reported**: supplied by the product owner without technical verification.
- **Unavailable**: no usable value exists.

Domain ownership and metric verification are separate. A verified domain does not automatically verify revenue, visitors, bids, purchases, or any other metric.

## Organic and promoted placement

Organic ordering uses launch time, unique upvotes, and eligible BidIndex outbound clicks. Payments and founder-reported metrics never affect organic position.

Promotions are disabled by default with `FEATURE_PROMOTIONS=false`. Any future paid placement must be visibly labelled `Promoted`, have a fixed server-controlled price and duration, activate only from a verified payment webhook, and remain completely separate from organic ranking queries.
