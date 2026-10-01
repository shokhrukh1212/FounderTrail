-- Deliberately retain new publications, access grants, schedules, drafts and recovery
-- evidence and the applied-migration checksum. Use an application compatibility fix.
DO $$ BEGIN
  RAISE EXCEPTION 'Instant launch rollback retains new data. Follow INSTANT_LAUNCH_RUNBOOK.md and deploy a compatibility fix instead.';
END $$;
