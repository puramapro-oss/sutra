-- Apply after the 20261012 permission migrations, including on existing installs.
-- RLS policies do not grant SQL privileges. Do not rely on the DDL owner's
-- default ACLs: supabase_admin and postgres may have different defaults.
BEGIN;
GRANT USAGE ON SCHEMA sutra TO service_role;
GRANT SELECT, INSERT, UPDATE ON sutra.video_jobs, sutra.video_quota_counters
  TO service_role;
-- Deliberately no client grant, DELETE, TRUNCATE or change to RLS/RPC security.
NOTIFY pgrst, 'reload schema';
COMMIT;
