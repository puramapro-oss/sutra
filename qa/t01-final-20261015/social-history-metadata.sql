-- Read-only stable metadata attestation; no account or event data is queried.
SELECT jsonb_build_object(
  'table', (SELECT jsonb_build_object('name',n.nspname||'.'||c.relname,
    'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE c.oid=to_regclass('sutra.social_authorization_history')),
  'columns', COALESCE((SELECT jsonb_agg(jsonb_build_object('position',a.attnum,
    'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
    'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text,
    'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=to_regclass('sutra.social_authorization_history')
      AND a.attnum>0 AND NOT a.attisdropped),'[]'::jsonb),
  'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',c.conname,
    'type',c.contype,'validated',c.convalidated,'deferrable',c.condeferrable,
    'initially_deferred',c.condeferred,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conname)
    FROM pg_constraint c WHERE c.conrelid=to_regclass('sutra.social_authorization_history')),'[]'::jsonb),
  'indexes', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',c.relname,
    'valid',i.indisvalid,'ready',i.indisready,'unique',i.indisunique,
    'definition',pg_get_indexdef(i.indexrelid)) ORDER BY c.relname)
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
    WHERE i.indrelid=to_regclass('sutra.social_authorization_history')),'[]'::jsonb),
  'policies', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',policyname,
    'permissive',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check) ORDER BY policyname)
    FROM pg_policies WHERE schemaname='sutra' AND tablename='social_authorization_history'),'[]'::jsonb),
  'triggers', COALESCE((SELECT jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,
    'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY t.tgname)
    FROM pg_trigger t WHERE NOT t.tgisinternal AND t.tgname IN
      ('sutra_capture_social_authorization_history','sutra_social_history_immutable')
      AND t.tgrelid IN (to_regclass('public.social_accounts'),to_regclass('sutra.social_authorization_history'))),'[]'::jsonb),
  'functions', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',p.proname,
    'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,
    'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname)
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sutra'
      AND p.proname IN ('capture_social_authorization_history','reject_social_history_mutation')
      AND p.pronargs=0),'[]'::jsonb),
  'role_privileges', (SELECT jsonb_agg(jsonb_build_object('role',role_name,
    'select',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'SELECT'),
    'insert',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'INSERT'),
    'update',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'UPDATE'),
    'delete',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'DELETE'),
    'truncate',has_table_privilege(role_name,to_regclass('sutra.social_authorization_history'),'TRUNCATE')) ORDER BY role_name)
    FROM unnest(ARRAY['anon','authenticated','service_role']) role_name)
);
