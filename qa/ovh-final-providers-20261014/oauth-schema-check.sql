SELECT json_object_agg(name, ok) FROM (VALUES
('columns', (SELECT count(*)=6 FROM information_schema.columns WHERE table_schema='sutra' AND table_name='social_oauth_states' AND column_name IN ('state_hash','user_id','platform','browser_hash','created_at','expires_at'))),
('rls', (SELECT relrowsecurity FROM pg_class WHERE oid='sutra.social_oauth_states'::regclass)),
('primary_key', EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='sutra.social_oauth_states'::regclass AND contype='p')),
('foreign_key', EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='sutra.social_oauth_states'::regclass AND contype='f' AND confrelid='auth.users'::regclass)),
('checks', (SELECT count(*)=3 FROM pg_constraint WHERE conrelid='sutra.social_oauth_states'::regclass AND contype='c')),
('expiry_index', to_regclass('sutra.social_oauth_states_expiry_idx') IS NOT NULL),
('service_select', has_table_privilege('service_role','sutra.social_oauth_states','SELECT')),
('service_insert', has_table_privilege('service_role','sutra.social_oauth_states','INSERT')),
('service_delete', has_table_privilege('service_role','sutra.social_oauth_states','DELETE')),
('service_no_update', NOT has_table_privilege('service_role','sutra.social_oauth_states','UPDATE')),
('anon_no_select', NOT has_table_privilege('anon','sutra.social_oauth_states','SELECT')),
('anon_no_insert', NOT has_table_privilege('anon','sutra.social_oauth_states','INSERT')),
('anon_no_delete', NOT has_table_privilege('anon','sutra.social_oauth_states','DELETE')),
('auth_no_select', NOT has_table_privilege('authenticated','sutra.social_oauth_states','SELECT')),
('auth_no_insert', NOT has_table_privilege('authenticated','sutra.social_oauth_states','INSERT')),
('auth_no_delete', NOT has_table_privilege('authenticated','sutra.social_oauth_states','DELETE'))
) checks(name,ok);
