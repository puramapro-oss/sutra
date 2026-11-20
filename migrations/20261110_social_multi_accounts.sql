-- Multiple explicit account destinations, retaining every account/history ID.
-- Apply after social-autopilot.sql and sutra_auto.sql, before the new routes.
-- No provider call, account creation, authorization backfill, ACL or RLS change.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.social_accounts') IS NULL
    OR obj_description(to_regclass('public.social_accounts'), 'pg_class') IS DISTINCT FROM
      'OAuth-connected social media accounts via Zernio'
    OR to_regclass('public.social_autopilot_config') IS NULL
    OR to_regclass('sutra.sutra_auto_config') IS NULL THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_MULTI_ACCOUNT_SCHEMA_REVIEW_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.social_accounts'::regclass
    AND attnum > 0 AND NOT attisdropped AND
      ((attname IN ('id','user_id') AND atttypid='uuid'::regtype)
        OR (attname IN ('platform','external_id') AND atttypid='text'::regtype))) <> 4 THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_MULTI_ACCOUNT_SCHEMA_REVIEW_REQUIRED';
  END IF;
END $$;

-- Serialize the constraint transition. No interval admits an unprotected insert.
LOCK TABLE public.social_accounts, public.social_autopilot_config, sutra.sutra_auto_config
  IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE item record;
BEGIN
  -- Preserve rows rather than guessing how to merge old identities. A noncanonical
  -- installation with duplicates must be reviewed; the transaction changes nothing.
  IF EXISTS (SELECT 1 FROM public.social_accounts
      GROUP BY user_id, platform, external_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_MULTI_ACCOUNT_DUPLICATES_REVIEW_REQUIRED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c WHERE c.conrelid='public.social_accounts'::regclass AND c.contype='u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(c.conkey) k(attnum)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum)
        = ARRAY['external_id','platform','user_id']::text[]
  ) THEN
    ALTER TABLE public.social_accounts ADD CONSTRAINT social_accounts_owner_platform_external_key
      UNIQUE(user_id, platform, external_id);
  END IF;
  -- Only remove unconditional singleton keys. Dependent foreign keys, if any,
  -- make this fail closed; CASCADE is deliberately not used.
  FOR item IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid='public.social_accounts'::regclass AND c.contype='u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(c.conkey) k(attnum)
        JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.attnum)
        = ARRAY['platform','user_id']::text[]
  LOOP
    EXECUTE format('ALTER TABLE public.social_accounts DROP CONSTRAINT %I', item.conname);
  END LOOP;
  FOR item IN
    SELECT i.indexrelid::regclass AS index_name FROM pg_index i
    WHERE i.indrelid='public.social_accounts'::regclass AND i.indisunique
      AND NOT i.indisprimary AND i.indpred IS NULL AND i.indexprs IS NULL
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid)
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum, position)
        JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
        WHERE k.position <= i.indnkeyatts)
        = ARRAY['platform','user_id']::text[]
  LOOP
    EXECUTE format('DROP INDEX %s', item.index_name);
  END LOOP;
END $$;

-- NULL is an unidentified legacy placeholder, not a newly authorized account.
-- Keep at most the old single placeholder; do not delete or assign an identity.
CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_owner_platform_legacy_null_key
  ON public.social_accounts(user_id, platform) WHERE external_id IS NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indexrelid='public.social_accounts_owner_platform_legacy_null_key'::regclass
      AND i.indrelid='public.social_accounts'::regclass AND i.indisunique AND i.indisvalid
      AND pg_get_expr(i.indpred, i.indrelid) = '(external_id IS NULL)'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
        FROM unnest(i.indkey::smallint[]) WITH ORDINALITY k(attnum, position)
        JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
        WHERE k.position <= i.indnkeyatts) = ARRAY['platform','user_id']::text[]
  ) THEN
    RAISE EXCEPTION 'SUTRA_SOCIAL_MULTI_ACCOUNT_NULL_INDEX_REVIEW_REQUIRED';
  END IF;
END $$;

-- Deliberately empty for EVERY existing configuration. Enabling a network in an
-- older configuration never opts future/new accounts into autonomous publishing.
ALTER TABLE public.social_autopilot_config
  ADD COLUMN IF NOT EXISTS publish_account_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
ALTER TABLE sutra.sutra_auto_config
  ADD COLUMN IF NOT EXISTS publish_account_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

DO $$
DECLARE target regclass; constraint_name text;
BEGIN
  FOREACH target IN ARRAY ARRAY['public.social_autopilot_config'::regclass, 'sutra.sutra_auto_config'::regclass]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid=target AND attname='publish_account_ids' AND NOT attisdropped
        AND atttypid='uuid[]'::regtype AND attnotnull) THEN
      RAISE EXCEPTION 'SUTRA_SOCIAL_DESTINATION_SCHEMA_REVIEW_REQUIRED';
    END IF;
    constraint_name := CASE WHEN target='public.social_autopilot_config'::regclass
      THEN 'social_autopilot_publish_account_ids_valid' ELSE 'sutra_auto_publish_account_ids_valid' END;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid=target AND conname=constraint_name) THEN
      EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I CHECK (
        COALESCE(array_ndims(publish_account_ids),1)=1
        AND cardinality(publish_account_ids)<=50
        AND array_position(publish_account_ids,NULL) IS NULL)', target, constraint_name);
    END IF;
  END LOOP;
END $$;
COMMENT ON COLUMN public.social_autopilot_config.publish_account_ids IS
  'Explicit local social account IDs; empty disables sends. Server rechecks owner, active consent and provider binding at execution.';
COMMENT ON COLUMN sutra.sutra_auto_config.publish_account_ids IS
  'Explicit local social account IDs; empty disables sends. Server rechecks owner, active consent and provider binding at execution.';

COMMIT;
