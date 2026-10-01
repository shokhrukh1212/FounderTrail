# Instant publication and launch rollout

Valid new Google-account submissions now publish immediately, grant listing management, and save the chosen launch in one transaction. Review & launch defaults visibly to **Publish & launch now**; scheduling and page-only publication are free alternatives. The revisitable workspace provides editable X copy, copy fallbacks, saved optional progress, and the existing Pro editor. Empty launch weeks lead with a compact invitation and real directory content.

Management access does not confer the domain-verification badge. Existing domain proof, disputes, reports, moderation, paid entitlements and historical engagement remain available. Administrators hide/restore listings with a recorded reason and can copy an activation link; this release sends no bulk outreach.

## Changed surfaces

| Surface | Responsibility |
| --- | --- |
| `/submit`, `SubmissionForm`, `LaunchChoice` | Preview, contact privacy, authorization, three launch choices, retained draft selection, optional saved-first Pro checkout |
| `POST /api/products` | Server validation, bounded submissions, exact product identity, idempotent transactional publication/access/launch |
| `/manage/[slug]/launch`, `ActivationWorkspace`, `LaunchScheduler` | Actual launch status, scheduling/cancellation, editable sharing and checklist persistence |
| `POST /api/owner/products/[slug]/launch` | Locked, one-per-product launch; real server start or validated future instant |
| `PATCH /api/owner/products/[slug]` | Explicit draft publication; rejected listings retain their moderation appeal path |
| `PATCH /api/owner/products/[slug]/activation` | Private post, composer activity, optional self-report/skip, deduplicated activation analytics |
| `/activate/[slug]`, `POST /api/products/[slug]/access` | Original-submitter association, authoritative Google contact match, or claimant-bound recovery confirmation |
| `/launch` | Preserve sign-in destination; choose eligible owned startup or submit a new one |
| `/`, `foundertrail-data`, votes, cron | Timestamp-derived current launches, genuine future launches, weekly ranking and empty-week discovery |
| Pro checkout, `LaunchKitPanel`, `LaunchStudio`, `launch-kit`, `pro-results` | Existing pricing/payment verification and real exports; actual launch dates; explicit refresh preserves edits |
| Admin product status API/table, `/admin/foundertrail` | Audited hiding/restoration, activation links, compact defined activation cohort |

Weeks are Monday 00:00 UTC through the following Monday, excluding the end instant. Launch now records the database clock rather than Monday. Local scheduling defaults to 09:00 and rejects past instants, dates beyond 180 days, and nonexistent local DST times. Repeated starts cannot reset rankings. A future launch can be changed or cancelled before it starts; its ID is retained. Public eligibility reads timestamps on each dynamic request and does not wait for cron. Cron still records scheduled activation, freezes expired weeks, and finalizes existing Pro reports.

Product identity normalizes scheme, `www` and a trailing path slash, while retaining path and query. PostgreSQL reserves that identity; separate products on a shared host remain separate. Existing exact duplicates reserve an ambiguous identity and require support resolution. Old URL reservations remain retained when a listing changes URL. The migration drops the older hostname-only publication index.

## Environment

No new external service or X API credentials are needed. Reuse existing values:

- `DATABASE_URL` (or existing `POSTGRES_URL`), canonical `SITE_URL`, `AUTH_SECRET` of at least 32 characters, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Production `EVENT_HASH_SALT` / `IP_HASH_SALT`; `CRON_SECRET` for the existing worker.
- Existing production S3-compatible upload configuration; valid manual submissions can publish without optional fetched media.
- `RESEND_API_KEY`, verified `EMAIL_FROM`: required for requested legacy recovery emails. If unavailable, account association still works and recovery offers domain proof/support. Links expire after 30 minutes, are single use, and require the same signed-in claimant to explicitly confirm. A GET never consumes one. Recovery fragments are removed before analytics and are never included in public URLs.
- Optional Pro uses the existing `PRO_LAUNCH_CHECKOUT_ENABLED`, Dodo test/live environment, API key, business ID, signed webhook key, and `$5`/`$9` product IDs documented in [PRO_LAUNCH_RUNBOOK.md](PRO_LAUNCH_RUNBOOK.md). Reservations and verified provider events remain authoritative; browser return parameters grant no entitlement.

Google stable subjects remain account identifiers; automatic email-based account merging is disabled. Only a recently server-recorded verified Gmail/Workspace email can auto-match the exact original private contact. Unrelated third-party Google email addresses use the recovery link. Editing a listing's contact never changes its migration-time recovery snapshot. Existing owners, conflicting owners and disputes are checked before any recovery grant.

## Exact migration and deployment sequence

Use a controlled operator environment. Confirm the hostname/database and current `schema_migrations`. These instructions authorize no automatic production execution. The checkout used for implementation had no production database credentials.

1. Check out the release commit on `main`; run `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` with the target deployment's configured environment.
2. Take a provider-native restore point and a protected native PostgreSQL archive. Restore it into an isolated rehearsal database and verify the restore. The existing JSON backup is secondary evidence. Keep archives and real reports outside Git.

```sh
pg_dump --format=custom --no-owner --file=/protected/pre-instant-launch.dump "$DATABASE_URL"
pg_restore --no-owner --dbname="$TEST_DATABASE_URL" /protected/pre-instant-launch.dump
```

3. Set `TEST_DATABASE_URL` in the private `.env.local` to the restored rehearsal database. Capture the baseline **before** migrations. Never bootstrap an existing database.

```sh
npm run foundertrail:baseline:test -- /protected/instant-baseline.json
npm run migrate:test
npm run migrate:test
USE_TEST_DATABASE=true npm run foundertrail:instant-migrate -- --report=/protected/instant-dry-run.json
```

`020_instant_launch` adds timing, identity reservations, activation progress, immutable contact snapshots, and hashed recovery tokens. It backfills old launch instants from their existing weeks without replacing launch IDs. The second schema command must report all migrations already applied. Earlier migrations remain checksum-protected; inspect any unapplied older migration, particularly the independently specified `017` category migration, using its existing runbook.

4. Inspect the dry-run report. It rolls back every proposed status/access change and sends no email. Only pending listings that pass automatic validation, have consent, have no unresolved duplicate, prior restrictive moderation, deleted submitter, dispute or conflicting owner can publish. Reliably recorded original submitters are associated with an audit; other owners and historical hidden listings are preserved. Missing consent/fields, duplicates and conflicts remain actionable exceptions. Existing listings are **never auto-launched**.

```sh
USE_TEST_DATABASE=true npm run foundertrail:instant-migrate -- --apply --report=/protected/instant-applied.json
USE_TEST_DATABASE=true npm run foundertrail:instant-migrate -- --apply --report=/protected/instant-rerun.json
npm run foundertrail:reconcile:test -- /protected/instant-baseline.json
```

The legacy runner writes its report before committing and fails/rolls back if historical fingerprints change. It checks full engagement, media, categories, credentials, metadata, launch and paid rows, and all product fields except the intentionally changed publication/status/update facts. Repeat apply should propose zero further grants/publications. Run with application writes paused so concurrent legitimate activity cannot invalidate the before/after fingerprint check.

5. Rehearse sign-in, fresh and concurrent submissions, all three launch choices, claimed/conflicting legacy records, one requested recovery email, time boundaries, logged-out discovery, moderation, and Dodo sandbox lifecycle. Use actual PostgreSQL for full transaction-concurrency rehearsal. For synthetic local-only checks, point a disposable migrated database/app at localhost and run:

```sh
node --env-file=.env.local scripts/verify-instant-migration.mjs
node --env-file=.env.local scripts/verify-instant-launch.mjs
```

Both scripts reject non-localhost targets and intentionally seed fixtures. The browser script requires `AUTH_SECRET` matching the local app and Chrome (`CHROME_BIN` can override its macOS path). Run the migration fixture script on a fresh disposable database before the browser fixture script. Never point them at a restored private dataset or production.

6. After rehearsal, pause production writes, take a fresh backup/baseline, and run the same commands against the intended production environment without `USE_TEST_DATABASE=true`: `npm run migrate`, the rollback-only `foundertrail:instant-migrate`, reviewed `--apply`, and `foundertrail:reconcile`. Deploy the release code against the migrated schema before resuming writes. Record release commit, restore point, report files and smoke results. Configure providers through the existing secret manager. Publication needs no payment or email-provider activation.

## Rollback preserving new data

Prefer a compatibility fix or roll-forward once new publications exist. Keep every new schema object, publication, owner grant, launch timestamp, progress draft, recovery audit and paid record. `020` down intentionally refuses rollback, preserving both data and its applied checksum; do not use generic `migrate:down` to undo this release. The unchanged older down migrations can remove historical/new tables.

If an access/status grant needs reversal, inspect its recorded audit and the reviewed migration report, confirm it has had no intervening legitimate edits, then make a targeted audited correction. Never bulk-delete owners or recreate products. For corruption requiring a native restore, restore to a separate database and reconcile/replay legitimate writes after the restore point before switching traffic. A plain old application deployment is not an adequate rollback: its approval gates and hostname assumptions would restore obsolete behavior.

## Verification evidence

All 220 unit/contract tests, typecheck, lint and the production build passed. The final browser/API run passed 32 checks. The API/browser run uses seeded sessions and a disposable PGlite engine exposing PostgreSQL's wire protocol. It exercises immediate anonymous publication, overlapping retries, a concurrent first submission, protected private mutations, actual times, scheduling/rescheduling/cancellation, recovery confirmation and expiry, original-submitters/conflicts, editable Unicode sharing, clipboard fallback, keyboard radio navigation, mobile overflow, real Pro PNG download, logged-out cache behavior, and moderation hide/restore. This does not substitute for full PostgreSQL concurrency, real OAuth, delivery, payment, or X account tests.

The six synthetic migration fixtures proposed/applied **1 publication, 4 access grants, 3 exceptions**; repeat apply made **0 publications and 0 grants**. Full historical fingerprints were unchanged, including nonempty lifetime/launch votes, comments, follows, clicks, profile visits, past launch results, a paid test order and its Pro entitlement. Exceptions were missing authorization consent, a conflicting manager, and an unresolved dispute. Production counts for the nearly 200 existing startups must come from the production dry-run; none were inspected or changed here.

- [API/browser checks](../../artifacts/instant-launch/verification.json), [migration summary](../../artifacts/instant-launch/migration-verification.json), [dry-run](../../artifacts/instant-launch/migration-dry-run.json), [apply](../../artifacts/instant-launch/migration-applied.json), [retry](../../artifacts/instant-launch/migration-rerun.json).
- [Review & launch desktop](../../artifacts/instant-launch/review-launch-desktop.png), [mobile](../../artifacts/instant-launch/review-launch-mobile.png).
- [Launched workspace](../../artifacts/instant-launch/workspace-launched-desktop.png), [scheduled workspace](../../artifacts/instant-launch/workspace-scheduled-desktop.png), [360 px workspace](../../artifacts/instant-launch/workspace-mobile.png).
- [Populated homepage](../../artifacts/instant-launch/home-populated.png), [empty-week homepage](../../artifacts/instant-launch/home-empty-week.png), [real exported PNG](../../artifacts/instant-launch/test-launch-kit.png).

Existing analytics deduplicate publication, launch transitions, workspace/link/composer/self-report activity, and successful image download by product/user/template/format. Existing `checkout_started` and `purchase_completed` events identify `product: pro_launch` and are order-deduplicated. Composer/download actions are not verified posts. Admin conversion is started launches among pages first published in the last rolling 30 days; future/cancelled launches do not convert, demos are excluded, and hidden pages stay in the historical cohort.

External provider exercises remain: real Google callback/subject behavior, Resend delivery and token confirmation, Dodo test-mode checkout/webhook cancellation/failure/delayed success, and a human X composer/attachment check. Reuse configured providers; ordinary X sharing adds no integration blocker. No live charge, real X post, bulk email, deployment or production migration was performed. Provider behavior follows [Google’s server verification guidance](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) and [X’s editable composer guidance](https://help.x.com/en/using-x/add-x-share-button).
