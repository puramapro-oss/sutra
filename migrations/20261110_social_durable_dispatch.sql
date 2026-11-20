-- The existing social journal remains the only publication authority.
-- Additive, server-only migration; existing journals are not activated/backfilled.
BEGIN;

DO $$ BEGIN
  IF to_regclass('sutra.social_publication_journals') IS NULL
    OR obj_description('sutra.social_publication_journals'::regclass, 'pg_class') IS DISTINCT FROM
      'SUTRA durable publication evidence. Never delete to retry a production; server role only.' THEN
    RAISE EXCEPTION 'SUTRA_PUBLICATION_SCHEMA_REVIEW_REQUIRED';
  END IF;
END $$;

ALTER TABLE sutra.social_publication_journals
  ADD COLUMN IF NOT EXISTS dispatch_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatch_error text;

CREATE INDEX IF NOT EXISTS social_publication_dispatch_due
  ON sutra.social_publication_journals(next_run_at, updated_at)
  WHERE dispatch_enabled AND kind='video' AND next_run_at IS NOT NULL;

-- Every replacement checks ownership, revision and the live database-time lease.
-- Admission has no lease; it cannot race an active consumer. Expired consumers
-- retain their existing operation keys and can never commit with an old token.
CREATE OR REPLACE FUNCTION sutra.save_social_publication_journal(
  p_kind text, p_production_id uuid, p_user_id uuid, p_revision integer,
  p_operations jsonb, p_lease_token uuid DEFAULT NULL, p_next_run_at timestamptz DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  journal sutra.social_publication_journals%ROWTYPE;
  old_op jsonb;
  new_op jsonb;
  result_revision integer;
BEGIN
  IF p_kind IS DISTINCT FROM 'video' OR p_revision IS NULL OR p_revision < 0
    OR jsonb_typeof(p_operations) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'SUTRA_PUBLICATION_JOURNAL_INVALID';
  END IF;
  SELECT * INTO journal FROM sutra.social_publication_journals
    WHERE kind=p_kind AND production_id=p_production_id AND user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR journal.revision<>p_revision THEN RETURN NULL; END IF;
  IF p_lease_token IS NULL THEN
    IF journal.lease_until>clock_timestamp() THEN RETURN NULL; END IF;
  ELSIF journal.lease_token IS DISTINCT FROM p_lease_token
    OR journal.lease_until IS NULL OR journal.lease_until<=clock_timestamp() THEN
    RETURN NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_operations) op
    WHERE jsonb_typeof(op) IS DISTINCT FROM 'object' OR coalesce(op->>'id','')=''
      OR jsonb_typeof(op->'request') IS DISTINCT FROM 'object'
      OR jsonb_typeof(op->'accountRows') IS DISTINCT FROM 'object'
      OR (op ? 'results' AND jsonb_typeof(op->'results') IS DISTINCT FROM 'array'))
    OR (SELECT count(*) FROM jsonb_array_elements(p_operations))<>
       (SELECT count(DISTINCT op->>'id') FROM jsonb_array_elements(p_operations) op) THEN
    RAISE EXCEPTION 'SUTRA_PUBLICATION_JOURNAL_INVALID';
  END IF;
  -- Accepted media, destinations, content and provider keys are immutable.
  FOR old_op IN SELECT value FROM jsonb_array_elements(journal.operations) LOOP
    SELECT value INTO new_op FROM jsonb_array_elements(p_operations)
      WHERE value->>'id'=old_op->>'id';
    IF p_lease_token IS NULL AND
      (new_op - ARRAY['dispatchRequested','retryRequested','blockedReason','nextAttemptAt']) IS DISTINCT FROM
      (old_op - ARRAY['dispatchRequested','retryRequested','blockedReason','nextAttemptAt']) THEN
      RAISE EXCEPTION 'SUTRA_PUBLICATION_LEASE_REQUIRED';
    END IF;
    IF new_op IS NULL OR new_op->'request' IS DISTINCT FROM old_op->'request'
      OR new_op->'accountRows' IS DISTINCT FROM old_op->'accountRows'
      OR new_op->'createdAt' IS DISTINCT FROM old_op->'createdAt'
      OR (old_op ? 'firstAttemptAt' AND new_op->'firstAttemptAt' IS DISTINCT FROM old_op->'firstAttemptAt')
      OR (old_op->>'phase'<>'queued' AND new_op->>'phase'='queued') THEN
      RAISE EXCEPTION 'SUTRA_PUBLICATION_INTENT_IMMUTABLE';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(old_op->'results','[]')) old_result
      WHERE old_result->>'status'='published' AND old_result->'success'='true'::jsonb
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(new_op->'results','[]')) new_result
          WHERE new_result @> old_result)) THEN
      RAISE EXCEPTION 'SUTRA_PUBLICATION_SUCCESS_IMMUTABLE';
    END IF;
  END LOOP;
  -- Only admission may append never-started destinations, never a consumer.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_operations) op
    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(journal.operations) previous WHERE previous->>'id'=op->>'id')
      AND (p_lease_token IS NOT NULL OR op->>'phase' IS DISTINCT FROM 'queued'
        OR op ? 'firstAttemptAt' OR op ? 'claimedAt'
        OR jsonb_array_length(coalesce(op->'results','[]'))<>0
        OR op->'dispatchRequested' IS DISTINCT FROM 'true'::jsonb)) THEN
    RAISE EXCEPTION 'SUTRA_PUBLICATION_ADMISSION_REQUIRED';
  END IF;

  UPDATE sutra.social_publication_journals SET operations=p_operations,
    revision=revision+1, updated_at=clock_timestamp(), dispatch_enabled=true,
    next_run_at=p_next_run_at,
    lease_token=CASE WHEN p_lease_token IS NULL THEN NULL ELSE lease_token END,
    lease_until=CASE WHEN p_lease_token IS NULL THEN NULL ELSE lease_until END
    WHERE kind=p_kind AND production_id=p_production_id AND user_id=p_user_id
    RETURNING revision INTO result_revision;
  RETURN result_revision;
END $$;

CREATE OR REPLACE FUNCTION sutra.claim_social_publication_journals(
  p_lease_token uuid, p_limit integer DEFAULT 1, p_lease_seconds integer DEFAULT 240
) RETURNS SETOF sutra.social_publication_journals
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_lease_token IS NULL OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 4
    OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 120 AND 300 THEN
    RAISE EXCEPTION 'SUTRA_PUBLICATION_CLAIM_INVALID';
  END IF;
  RETURN QUERY
    WITH due AS (
      SELECT j.kind,j.production_id FROM sutra.social_publication_journals j
      WHERE j.kind='video' AND j.dispatch_enabled AND j.next_run_at<=clock_timestamp()
        AND (j.lease_until IS NULL OR j.lease_until<=clock_timestamp())
      ORDER BY j.next_run_at,j.updated_at,j.production_id
      FOR UPDATE SKIP LOCKED LIMIT p_limit
    ) UPDATE sutra.social_publication_journals j SET lease_token=p_lease_token,
      lease_until=clock_timestamp()+make_interval(secs=>p_lease_seconds),
      revision=j.revision+1, dispatch_attempts=least(j.dispatch_attempts+1,1000000)
      FROM due WHERE j.kind=due.kind AND j.production_id=due.production_id RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION sutra.release_social_publication_journal(
  p_kind text, p_production_id uuid, p_user_id uuid, p_lease_token uuid,
  p_next_run_at timestamptz DEFAULT NULL, p_error_code text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF p_error_code IS NOT NULL AND (length(p_error_code)>96 OR p_error_code !~ '^SUTRA_[A-Z_]+$') THEN
    RAISE EXCEPTION 'SUTRA_PUBLICATION_ERROR_CODE_INVALID';
  END IF;
  UPDATE sutra.social_publication_journals SET lease_token=NULL,lease_until=NULL,
    next_run_at=p_next_run_at,last_dispatch_error=p_error_code,
    revision=revision+1,updated_at=clock_timestamp()
    WHERE kind=p_kind AND production_id=p_production_id AND user_id=p_user_id
      AND lease_token=p_lease_token AND lease_until>clock_timestamp();
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION sutra.save_social_publication_journal(text,uuid,uuid,integer,jsonb,uuid,timestamptz),
  sutra.claim_social_publication_journals(uuid,integer,integer),
  sutra.release_social_publication_journal(text,uuid,uuid,uuid,timestamptz,text)
  FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION sutra.save_social_publication_journal(text,uuid,uuid,integer,jsonb,uuid,timestamptz),
  sutra.claim_social_publication_journals(uuid,integer,integer),
  sutra.release_social_publication_journal(text,uuid,uuid,uuid,timestamptz,text) TO service_role;

COMMENT ON COLUMN sutra.social_publication_journals.dispatch_enabled IS
  'Explicit durable admission only. Existing journals are never activated by migration.';
COMMIT;
