# FounderTrail migration runbook

For the current Pro Launch release, use this preservation procedure together with
[`PRO_LAUNCH_RUNBOOK.md`](PRO_LAUNCH_RUNBOOK.md). Rehearse every pending migration
through `016_pro_launch`; the older numbered examples below describe the original
FounderTrail migration and remain as historical context.

Do not run these commands from an ordinary developer shell pointed at production. Use a controlled migration window, a named environment, and an operator who can restore the database.

## 1. Prepare and back up

1. Confirm the target hostname/database name from `DATABASE_URL`; never assume the current `.env.local` is safe.
2. Pause application writes or place the site in maintenance mode.
3. Create a provider-native Neon restore point/branch and a full PostgreSQL archive, for example `pg_dump --format=custom --no-owner --file=<protected-path> "$DATABASE_URL"` from a secured operator environment.
4. Restore that archive into an isolated database and run basic row-count/query checks. A backup without a rehearsed restore is not the release gate.
5. Point a separate environment file at the isolated rehearsal database.
6. Run `npm run foundertrail:baseline -- <protected-baseline-path>`. The report contains hashes rather than raw contacts/URLs, but still keep mode 0600 outside source control.
7. Record current `schema_migrations`, product count, publication-status counts, legacy-vote count, outbound-click count, media count, and update count.

The existing `npm run backup` JSON export is useful secondary evidence but is not a substitute for a transactional PostgreSQL backup/restore.

## 2. Rehearse

1. Check out the exact release commit and install from the lockfile.
2. Run `npm run migrate` against the restored rehearsal database. Do not run `db:bootstrap`; that command is only for a completely empty disposable database.
3. Run `npm run foundertrail:reconcile -- <same-baseline-path>`. The privacy-safe result and artifact hash are recorded in `migration_reconciliation_runs` for the admin health view; the protected baseline file remains outside source control.
4. Check migrations 011–012: one product owner, one initial product launch, unique account vote, Monday UTC seven-day weeks, sponsor no-overlap, fixed USD 900 minor-unit base price, unique Stripe scope, claim-invitation campaign constraint, and reconciliation recording.
5. Start the application against the rehearsal database and complete the verification checklist in `VERIFICATION.md`.
6. Repeat the migration command to prove it reports all files already applied and does not change data.

## 3. Production migration

1. Keep `SPONSORSHIPS_ENABLED=false` and do not expose Dodo/Stripe credentials in preview deployments.
2. Deploy the code only when the backup/restore and rehearsal gates pass.
3. Pause writes, take a fresh native backup/restore point, and capture a fresh baseline.
4. Run `npm run migrate` once. The advisory lock serializes another migration runner; checksum mismatches stop execution.
5. Run baseline reconcile and the database smoke queries below.
6. Resume reads/writes and test public Discover, a product profile, sign-in, ownership, and admin health.
7. Configure and enable Resend/auth, Stripe metrics, and Dodo sponsorship separately. Turn on sponsorship only after a complete Dodo test-mode lifecycle.

Useful smoke queries:

```sql
SELECT name, applied_at FROM schema_migrations ORDER BY name;
SELECT status, count(*) FROM products GROUP BY status ORDER BY status;
SELECT count(*) FROM product_votes;       -- historical support
SELECT count(*) FROM product_launches;    -- must not be auto-filled
SELECT count(*) FROM product_owners;
SELECT booking_status, payment_status, count(*) FROM sponsor_bookings GROUP BY 1,2;
SELECT processing_status, count(*) FROM payment_webhook_receipts GROUP BY 1;
```

## Rollback and recovery

Prefer roll-forward after production traffic reaches the new schema. The 011 down migration deletes account, ownership, launch, follow, discussion, Stripe, sponsorship, job, and audit data; 012 removes claim-invitation/reconciliation state. They are safe only before any real new-system writes. Never run `npm run migrate:down` casually.

- Before new writes: stop the app, verify the exact migration targets, roll back 012 before 011 only if explicitly approved, deploy the previous code, and reconcile historical data.
- After new writes: disable affected feature flags, deploy a compatibility fix, retain all new tables, and roll forward. If corruption cannot be repaired, restore the tested native backup to a new database and switch the connection deliberately.
- Payment incident: disable `SPONSORSHIPS_ENABLED`, retain webhook receipts/bookings, reconcile with Dodo, and process queued or manual refunds. Do not delete evidence.
- Credential incident: revoke Dodo/Resend/Google/Stripe keys at the provider, rotate `AUTH_SECRET`, `METRIC_ENCRYPTION_KEY`, `CRON_SECRET`, and salts as appropriate, and audit affected connections. Changing the metric encryption key requires reconnecting stored Stripe keys unless a controlled re-encryption is performed first.

## Post-migration reconciliation

Run the same baseline file against production. Investigate every missing product, changed identity hash, or decreased historical count before enabling providers. New tables may increase counts; existing records must not decrease. Store the migration log, baseline results, release commit, backup ID, operator, start/end times, and smoke-test outcome in the private operations record.
