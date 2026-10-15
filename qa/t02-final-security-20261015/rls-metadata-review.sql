-- T01 only: metadata read on its approved disposable copy / authorized target.
-- Not executed by T02. No application rows, tokens or secret values are selected.
BEGIN READ ONLY;
SELECT n.nspname AS schema_name, c.relname AS table_name,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls,
       r.rolname AS role_name,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS table_select,
       has_any_column_privilege(r.oid, c.oid, 'SELECT') AS any_column_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS table_insert,
       has_any_column_privilege(r.oid, c.oid, 'INSERT') AS any_column_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS table_update,
       has_any_column_privilege(r.oid, c.oid, 'UPDATE') AS any_column_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS table_delete,
       has_table_privilege(r.oid, c.oid, 'TRUNCATE') AS table_truncate,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'sutra' AND c.relkind IN ('r', 'p')
  AND c.relname IN ('activity_logs', 'api_logs', 'error_logs',
                   'contest_submissions', 'referral_commissions', 'referrals')
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY c.relname, r.rolname;
ROLLBACK;
