# BidIndex product brief

## Purpose and users

BidIndex is the discovery platform for pay-to-rank products, ad auctions, attention marketplaces and other bidding experiments. Discover new launches, compare their traction and submit your own product for free.

BidIndex brings the growing world of bidding products into one transparent discovery platform. Explore pay-to-rank directories, ad auctions, attention marketplaces and other bidding experiments, follow their launches and compare their traction. Founders can submit products for free, publish updates and connect optional integrations. When traffic, clicks or revenue are displayed, BidIndex clearly identifies where each number came from.

The core value is provenance. A product badge and every metric answer different questions and must never be presented as the same claim.

## Product and metric trust model

A **Verified product** has met both requirements:

1. BidIndex confirmed control of the submitted domain using a meta tag or well-known file.
2. BidIndex detected the configured BidIndex badge and public project ID on that domain.

This verifies the product identity and badge installation only. It does not prove revenue, visitors, purchases, bids, or business performance. Revenue integration is optional.

Every displayed metric has its own source:

- **Measured by BidIndex** — directly measured by BidIndex, including eligible outbound clicks and privacy-conscious badge traffic.
- **Processor verified** — received through a future official payment-processor connection. This is reserved and is never shown without a real connector.
- **Partner connected** — sent by the founder's authenticated server. Authentication proves which integration sent it, not that BidIndex independently audited it.
- **Publicly sourced** — taken from a public page and accepted by a BidIndex administrator.
- **Founder reported** — entered by a founder without technical verification.
- **Unavailable** — no usable measurement exists.

## Owner experience

The founder path remains **Paste URL → review extracted details → submit → receive management link → get approved → connect verified data**.

Initial public fields are website URL, product name, one-line description, and launch date. Founder name and social handle are optional public fields. Contact email is required and private; it supports approval, owner assistance, management-link recovery, and verification coordination. It is excluded from public loaders, APIs, metadata, and page source.

If an owner loses the one-time link, an administrator first verifies the founder using that private contact email, then generates a replacement link from moderation. Rotation invalidates the old link immediately; only the new token's hash is stored, and the raw replacement is shown once.

Pending owners see a real database-backed Pending review state and can check manually while the page also polls about every 30 seconds. Approval makes the product public before BidIndex attempts email. Once live, the dashboard shows a launch banner with a canonical product link and an X Web Intent; the founder always reviews and publishes the post personally.

Approval email is transactional and goes only to the private submission contact. It includes responsive HTML, plain text, the product logo when available, the public listing, the same attributed X share intent, and a signed private management link. Email failure never reverses publication, and administrators can safely retry without duplicating a successfully recorded notification.

After approval, the owner dashboard has three focused tabs:

- **Product** — product name, one-line description, optional founder information, read-only approved website, logo, and screenshots.
- **Updates** — compact founder update publishing and history.
- **Verification & data** — domain proof, badge installation, traffic status, optional server events, and reviewed public evidence.

Administrators assign one primary category. Owners cannot silently change the approved website because doing so would invalidate the domain relationship.

## Discovery and ranking

The public discovery views remain Launching today, Trending, Verified, and Newest. Every view lists the whole matching set across numbered pages, with the total stated under the pager, so a tab name is never read as a hidden time filter. Listed metrics and ranking signals are both all-time: Launching today and Trending order by all-time upvotes, then all-time eligible BidIndex outbound clicks, then the newer launch. A seven-day window ranked the board until now, but it said little while most products were days old and it reshuffled the order every night. Weekly figures stay in the card data, unranked and unshown. Payments, promotions, sponsorships, and founder-reported values never improve organic position.

An upvote is a per-product row keyed on the anonymous `bidindex_visitor` cookie. That cookie is under the voter's control, so identity alone cannot carry the count: clearing it, or sending no cookie at all, mints a fresh voter. The vote route therefore also caps upvotes per address block — at most three active upvotes on one product from one `/24`, and a stricter hourly bucket for cookie-less callers, whose per-visitor allowance can never bind. A first-time visitor and a founder upvoting someone else's product both still count on the first click, with no reload. Product owners remain unable to upvote their own product. Until sign-in exists, an upvote means one anonymous browser, and the wording around the number should not claim more.

Metric leaderboards include only eligible measured, processor-connected, authenticated partner, or accepted public sources and always show the source label. Currencies remain separate. No data is preferable to a synthetic or misleading zero.

Production public queries exclude pending, rejected, archived, and demo records. Demo data remains an explicit development/test seed only.

## Intentionally excluded

Forums, direct messages, followers, collections, reviews, awards, newsletters, complex recommendations, advanced charts, mobile apps, browser extensions, large-scale scraping, social authentication, paid organic ranking, and rushed payment-provider OAuth are outside this MVP. Existing Lemon Squeezy payment infrastructure is preserved for future clearly labelled promotions behind `FEATURE_PROMOTIONS=false`.
