# BidIndex partner integration

Examples use `http://localhost:3000`; use the configured `SITE_URL` outside local development. Create the integration from `/manage/[slug]/integration`. The public project ID is safe for browser code; the server secret is shown once and must stay server-side.

## Badge installation

The owner page generates three ready-to-copy variants:

```html
<script async
  src="http://localhost:3000/embed/badge.js"
  data-project="PROJECT_PUBLIC_ID"
  data-style="light"></script>
```

`data-style` accepts `light`, `dark`, or `compact`. The script renders inline where installed, so header placement is never required. An unverified integration says `Live on BidIndex`; verified integrations may say `Live on BidIndex · Verified data` or show available verified revenue. The badge opens the tracked `/from/[publicId]` referral route, which leads to the BidIndex product profile. Badge referrals are stored separately from outbound product clicks.

## Domain verification

Publish the exact generated token as plain text at:

```text
https://YOUR_REGISTERED_DOMAIN/.well-known/bidindex-verification.txt
```

Then select **Check domain**. Verification accepts HTTPS port 443 only, resolves every address first, rejects private/special addresses, pins the selected public address while preserving TLS hostname validation, follows no redirects, and enforces byte and time limits. Domain control does not verify revenue or any other metric.

## Public visitor tracking

The badge script sends `POST /api/events/visitor` with `projectId`, a random browser `visitorId`, and an event ID. BidIndex accepts pageviews only after domain verification and only when the browser `Origin` hostname exactly matches the registered domain. Events are rate-limited, obvious bots are ignored, and visitors are deduplicated per UTC day.

Stored data is limited to the integration/product IDs, received time, server-HMACed browser identifier, server-HMACed network/user-agent abuse key, and aggregate. BidIndex does not store raw IP addresses or collect paths, page titles, page contents, forms, email, or advertising identifiers.

## Server-to-server events

Revenue, purchases, and bids must come from a trusted server:

```bash
curl -X POST http://localhost:3000/api/integrations/PROJECT_PUBLIC_ID/events \
  -H 'Authorization: Bearer YOUR_SERVER_SECRET' \
  -H 'Content-Type: application/json' \
  -d '{
    "eventId": "order_123",
    "type": "purchase_completed",
    "occurredAt": "2026-08-27T10:00:00.000Z",
    "valueMinor": 12700,
    "currency": "USD"
  }'
```

Supported types are `purchase_completed`, `bid_completed`, and `revenue_recorded`. `valueMinor` must be a non-negative safe integer in the supplied three-letter currency. Timestamps must be within ten minutes of receipt. Original currencies remain separate and are never converted.

`eventId` must be stable across retries and 8–120 URL-safe characters. A retry returns `{ accepted: true, duplicate: true }` without changing an aggregate. Secret rotation immediately invalidates the previous secret; update event senders atomically.

## Verification meanings

- `Verified live`: accepted from the authenticated event API, or from a domain-verified exact-origin visitor integration.
- `Verified by BidIndex`: directly measured by BidIndex, such as an eligible `/go/[slug]` outbound click.
- `Publicly sourced`: entered with a public source URL.
- `Founder reported`: supplied without technical verification.
- `Unavailable`: no usable value exists.

## Local testing

1. Put a non-production PostgreSQL URL in `.env.local` as `DATABASE_URL`.
2. Set long local values for `EVENT_HASH_SALT` and `ADMIN_ACCESS_SECRET`.
3. Run `npm run migrate` and `npm run seed:demo -- --confirm-demo`.
4. Run `npm run dev`, open a product management URL, and create an integration.
5. `ALLOW_LOCAL_PARTNER_ORIGINS=true` permits localhost browser-origin fixtures only in development. Never enable it in production.
6. Domain proof still requires a publicly resolvable HTTPS domain; it intentionally cannot target a local/private server.
