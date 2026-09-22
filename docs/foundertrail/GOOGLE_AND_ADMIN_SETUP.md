# Google sign-in and administrator setup

FounderTrail uses Better Auth 1.7 with Google as its only public sign-in provider. Public browsing works without OAuth credentials, but upvoting, following, commenting, claiming, submitting, product management, and normal administrator access require Google sign-in.

## 1. Create the Google OAuth client

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and select the project that will own FounderTrail sign-in, or create one.
2. Open **Google Auth Platform → Branding**. Set the app name to FounderTrail, choose a support email, and add the existing production URLs:
   - Homepage: `https://bidindex.dev`
   - Privacy policy: `https://bidindex.dev/privacy`
   - Terms: `https://bidindex.dev/terms`
3. Open **Audience**. During testing, use an External app in testing mode and add each Google account that should be allowed to test. A testing-mode app is not public to arbitrary visitors. Move it to production when the consent configuration is complete. FounderTrail requests only `openid`, `email`, and `profile`; follow the notices shown in the current Google console if it asks for any additional review.
4. Open **Clients**, create an OAuth client, and choose **Web application**.
5. Add these exact authorised redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://bidindex.dev/api/auth/callback/google`

This server-side Better Auth flow does not need an authorised JavaScript origin. If Google later requires one for a separate browser SDK, an origin contains only the scheme, host, and port—for example `http://localhost:3000`—while a redirect URI includes `/api/auth/callback/google`.

Copy the generated **Client ID** and **Client Secret** into the matching private environment variables. Never paste either secret into chat, source control, or a `NEXT_PUBLIC_` variable.

## 2. Set the exact environment variables

For local development, copy `.env.example` to the ignored `.env.local` file. In production, add the same values in the deployment provider's encrypted environment settings.

| Exact variable name | Where to get it | Where to put it | Required locally | Required in production |
| --- | --- | --- | --- | --- |
| `SITE_URL` | This application's public origin | `.env.local` / deployment settings | Yes: `http://localhost:3000` | Yes: `https://bidindex.dev` |
| `DATABASE_URL` | Neon connection settings for the selected environment | `.env.local` / deployment secret | Yes | Yes |
| `AUTH_SECRET` | Generate once with `openssl rand -base64 32` | `.env.local` / deployment secret | Yes | Yes |
| `GOOGLE_CLIENT_ID` | Google Auth Platform → Clients | `.env.local` / deployment secret | Yes for sign-in | Yes |
| `GOOGLE_CLIENT_SECRET` | Google Auth Platform → Clients | `.env.local` / deployment secret | Yes for sign-in | Yes |
| `ADMIN_ACCESS_SECRET` | Existing operator recovery secret, if retained | `.env.local` / deployment secret | No | Optional legacy recovery only |

Do not rotate an existing working `AUTH_SECRET` during this change: doing so invalidates sessions. Do not reuse the Google client secret as `AUTH_SECRET`. Resend, Dodo, Stripe, and analytics variables are not prerequisites for Google sign-in.

Restart `npm run dev` after changing `.env.local`.

## 3. Verify readiness safely

Run:

```bash
npm run foundertrail:readiness
```

The command reports the selected environment, a one-way database fingerprint, database reachability, present/missing auth variables, computed origin and callback, latest migration, and the number of verified Google administrator identities. It never prints credentials, connection strings, emails, or tokens. It is a local command, not a public endpoint.

## 4. Grant the owner administrator access

1. Start FounderTrail and sign in once at `http://localhost:3000/sign-in` using the intended Google account. This creates the verified Better Auth user and provider identity.
2. Preview the exact stored identity; this does not change anything:

   ```bash
   npm run foundertrail:set-admin -- owner@example.com
   ```

3. Check the masked email, stable user ID, provider, selected environment, and current role in the preview.
4. Apply the role explicitly:

   ```bash
   CONFIRM_ADMIN_ROLE=owner@example.com npm run foundertrail:set-admin -- owner@example.com --apply
   ```

5. The command invalidates that user's existing sessions. Sign in again, then open `http://localhost:3000/admin`. The operational dashboard is at `http://localhost:3000/admin/foundertrail`.
6. Verify a normal Google account receives **Access denied** on the admin pages and a `401` response from admin APIs.

To revoke a non-final administrator, preview first and then run:

```bash
CONFIRM_ADMIN_ROLE=owner@example.com npm run foundertrail:set-admin -- owner@example.com --apply --revoke
```

The command refuses missing or ambiguous identities, accounts without a verified Google provider, and revoking the final active administrator. Every change is audited. The old shared-secret form was removed from normal navigation because it could appear valid while the role-protected APIs denied it; `/admin/recovery` is retained only for an already configured legacy operator session during migration.

## Troubleshooting

- **`redirect_uri_mismatch`**: compare the callback printed by `npm run foundertrail:readiness` with Google Auth Platform. Scheme, host, port, and path must match exactly. Do not use `127.0.0.1` if the registered URI uses `localhost`.
- **Google button says unavailable**: run the readiness command and add the missing `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, or `GOOGLE_CLIENT_SECRET`, then restart the dev server.
- **Access blocked / test user denied**: in Google Auth Platform → Audience, add the account as a test user or move the correctly configured app to production.
- **User cancelled**: return to `/sign-in` and choose Continue with Google again. FounderTrail does not create an account until Google completes the callback.
- **Account-link conflict**: do not enable broad email auto-linking. Confirm which existing account/provider owns the email and use an explicit operator-assisted recovery or linking process.
- **Cookie/session mismatch**: ensure `SITE_URL` is the same origin used in the browser, clear only the local FounderTrail session cookie, restart the app, and try again. Production cookies require HTTPS.
- **Admin still denied**: rerun the role command in preview mode, confirm the database fingerprint/environment, apply to the correct verified Google identity, and sign in again because role changes invalidate sessions.
- **Safe logs**: local server errors appear in the terminal running `npm run dev`; deployment errors appear in the provider's function logs. Never copy OAuth codes, cookies, tokens, or full database errors into public issues.

Official implementation references: [Better Auth Google provider](https://www.better-auth.com/docs/authentication/google), [Better Auth account linking](https://www.better-auth.com/docs/concepts/users-accounts), and [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).
