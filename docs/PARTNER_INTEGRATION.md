# BidIndex partner integration

The owner dashboard generates project-specific values from the environment-configured `SITE_URL`. Examples below use placeholders. The public project ID belongs in browser code; the server secret never does.

## What verifies a product

A product becomes a **Verified product** after BidIndex confirms both its submitted domain and its installed badge. Revenue or server events are not required. Verification means the domain and badge were confirmed; each public metric still carries a separate source label.

## 1. Verify the domain

The recommended method is a meta tag. Copy the generated tag into the `<head>` of the approved website, deploy it, and click **Check verification**:

```html
<meta name="bidindex-verification" content="YOUR_VERIFICATION_TOKEN">
```

Alternatively, serve a plain-text file containing only the generated token at:

```text
https://YOUR_REGISTERED_DOMAIN/.well-known/bidindex-verification.txt
```

In Next.js, that normally means `public/.well-known/bidindex-verification.txt`. A `not_found` result means BidIndex received no usable proof at the derived location. Confirm the deployment is public over HTTPS and retry. The check always derives its target from the stored approved URL; founders cannot submit an arbitrary verification target.

## 2. Install the badge and traffic script

Choose Light, Dark, or Compact in the owner dashboard, preview it, then copy the single generated snippet:

```html
<script async
  src="https://YOUR_BIDINDEX_ORIGIN/embed/badge.js"
  data-project="YOUR_PUBLIC_PROJECT_ID"
  data-style="light"></script>
```

Place it anywhere appropriate in the product site; header placement is not required. Deploy, then click **Check installation**. BidIndex safely checks the approved product page for the exact configured script origin, path, and project ID. Badge installation state is separate from recent traffic activity, so a low-traffic site does not lose product verification.

The badge links through `/from/[publicId]` to the public BidIndex product page. Badge clicks are tracked separately from BidIndex's `/go/[slug]` product-site outbound clicks.

## Traffic measurement and privacy

The asynchronous badge script can report:

- pageviews;
- approximate daily unique visitors;
- badge impressions;
- badge clicks back to BidIndex;
- referring hostname when the browser provides one.

It does **not** read or transmit form values, names, email addresses, payment information, host cookies, host local storage, page/DOM content, full URL query strings, fragments, keystrokes, or cross-site identities. It uses no persistent cookie or persistent browser fingerprint. The browser sends a random per-event ID using `navigator.sendBeacon` where possible and a safe fetch fallback.

BidIndex validates `Origin` against the verified domain, filters obvious bots, rate-limits, and deduplicates events. Approximate daily uniques are calculated from a rotating HMAC containing the project ID, UTC date, a truncated server-observed network, and a coarse user-agent category. Raw IP addresses and full user agents are never stored in analytics tables. Counts are estimates and may be affected by ad blockers, browser restrictions, and bots.

BidIndex outbound clicks originate only through `/go/[slug]`, which resolves the product's stored approved URL. This metric is labelled **Measured by BidIndex**.

## 3. Optional authenticated server events

Domain verification and the badge are enough to verify the product. Create a server secret only to display live revenue, purchases, refunds, bids, or product events. The secret is shown once, stored only as a hash, and must remain in encrypted server environment settings. Rotating it immediately invalidates the old value.

Endpoint:

```text
POST https://YOUR_BIDINDEX_ORIGIN/api/partner/v1/events
```

All events require `project_id`, a stable per-product `event_id`, `type`, and an ISO-8601 `occurred_at`. Monetary events also require a safe integer `amount_minor` and uppercase ISO-4217 `currency`. Never send customer names, email addresses, card data, billing addresses, or arbitrary payment payloads. Retries must reuse the event ID.

Supported types are `purchase`, `refund`, `revenue`, `bid`, and `product_click`. `product_click` omits amount and currency. For a refund, send the positive refunded amount; BidIndex subtracts it from the matching currency total. Events must be no more than 24 hours old or five minutes in the future.

### cURL

```bash
curl --request POST "https://YOUR_BIDINDEX_ORIGIN/api/partner/v1/events" \
  --header "Authorization: Bearer YOUR_SERVER_SECRET" \
  --header "Content-Type: application/json" \
  --data '{
    "project_id": "YOUR_PUBLIC_PROJECT_ID",
    "event_id": "order_12345678",
    "type": "purchase",
    "occurred_at": "2026-08-28T10:00:00.000Z",
    "amount_minor": 12700,
    "currency": "USD"
  }'
```

### Node.js

```js
const response = await fetch(`${process.env.BIDINDEX_URL}/api/partner/v1/events`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${process.env.BIDINDEX_SERVER_SECRET}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    project_id: process.env.BIDINDEX_PROJECT_ID,
    event_id: order.id,
    type: "purchase",
    occurred_at: order.completedAt.toISOString(),
    amount_minor: order.totalMinor,
    currency: order.currency.toUpperCase(),
  }),
});
if (!response.ok) throw new Error(`BidIndex event failed: ${response.status}`);
```

### Next.js server route

```ts
import { NextResponse } from "next/server";

export async function POST() {
  const event = {
    project_id: process.env.BIDINDEX_PROJECT_ID,
    event_id: "order_12345678",
    type: "purchase",
    occurred_at: new Date().toISOString(),
    amount_minor: 12700,
    currency: "USD",
  };
  const upstream = await fetch(`${process.env.BIDINDEX_URL}/api/partner/v1/events`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.BIDINDEX_SERVER_SECRET}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(event),
  });
  return NextResponse.json(await upstream.json(), { status: upstream.status });
}
```

Successful new events return HTTP 202; duplicate IDs return HTTP 200 without aggregating again. Errors use a stable JSON `error` code. Metrics from this endpoint are labelled **Partner connected**: the sender is authenticated, but BidIndex has not independently audited the founder's business.

## Other ways to show a metric

An owner may expand **Other ways to show a metric** and submit an already-public revenue or traffic page. The evidence starts pending. An administrator may accept it as **Publicly sourced**, reject it with a note, later mark it stale, or archive it. This is separate from badge traffic and authenticated events.

## Local testing

1. Configure a disposable local/test database plus `SITE_URL`, `EVENT_HASH_SALT`, and `ADMIN_ACCESS_SECRET` in `.env.local`.
2. Run `npm run migrate`.
3. Optionally run `npm run seed:demo -- --confirm-demo` only against that disposable database.
4. Run `npm run dev`, submit and approve a product, then open its Verification & data tab.
5. `ALLOW_LOCAL_PARTNER_ORIGINS=true` enables localhost partner fixtures only outside production. Keep it `false` in production.
