# Future payment-processor connectors

FounderTrail currently supports generic authenticated partner events. Their metrics are **Partner connected**, not processor verified. `Processor verified` is reserved for a real first-party connection to Stripe, Lemon Squeezy, Paddle, or an equivalent provider.

A future connector must:

- use the provider's official OAuth or account-authorization mechanism rather than asking a founder to paste an unrestricted secret key;
- request the minimum read/webhook scopes required;
- store refresh/access tokens encrypted at rest and never expose them to client bundles or logs;
- receive provider-signed webhooks and verify signatures against the exact raw request body;
- enforce provider event idempotency, ordering tolerance, retry safety, and replay windows;
- process refunds, disputes, chargebacks, and currency-specific adjustments;
- retain original integer minor units and currencies without silent conversion;
- avoid customer names, emails, addresses, card details, and other unnecessary PII;
- separate imported historical totals from live webhook events and label their periods clearly;
- support revocation, credential expiry, degraded state, and last-success timestamps.

Only data successfully received and authenticated through such a connector may use **Processor verified**. The existing FounderTrail Lemon Squeezy merchant integration is preserved payment infrastructure for FounderTrail itself; it is not a founder payment-provider connector and must not be presented as one.
