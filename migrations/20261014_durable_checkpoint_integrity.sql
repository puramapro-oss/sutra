-- Durable completion and immutable provider intent. Apply after v11.
-- Compatible function replacement only; no historical row mutation.
-- No historical data mutation and no CHECK expansion. CREATE OR REPLACE retains existing ACLs.
BEGIN;
SET LOCAL search_path TO sutra, public;

CREATE OR REPLACE FUNCTION finish_video_job(p_job_id uuid,p_worker text,p_status text,p_error text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; target text;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR p_worker IS NULL OR j.locked_by IS DISTINCT FROM p_worker
  OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST';
 END IF;
 IF p_status NOT IN ('done','failed','queued','reconciliation_required') THEN RAISE EXCEPTION 'SUTRA_INVALID_JOB_TRANSITION'; END IF;
 IF p_status='done' AND (NOT (j.progress ? 'result') OR (j.progress->'result'='null'::jsonb AND NOT coalesce(
   j.kind='production' AND j.payload->'input'->>'step'='music' AND j.payload->'input'->>'musicStyle'='none'
   AND j.progress->'steps'->'stage:music'->>'status'='skipped'
   AND j.progress->'steps'->'stage:music'->'value'='null'::jsonb,false)))
 THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_RESULT_CHECKPOINT_REQUIRED'; END IF;
 target:=p_status;
 IF p_status='queued' AND (p_error LIKE '%SUTRA_RECONCILIATION_REQUIRED%' OR j.attempts>=j.max_attempts) THEN target:='reconciliation_required'; END IF;
 UPDATE video_jobs SET status=target,last_error=p_error,locked_by=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=j.id;
 -- Exactly one settlement, in the job transaction and in its original reservation month.
 IF target IN ('done','failed') THEN
  UPDATE video_quota_counters SET reserved=reserved-1,
   completed=completed+CASE WHEN target='done' THEN 1 ELSE 0 END,
   released=released+CASE WHEN target='failed' THEN 1 ELSE 0 END, updated_at=clock_timestamp()
   WHERE user_id=j.user_id AND period_start=date_trunc('month',j.created_at)::date AND reserved>0;
  IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_QUOTA_RECONCILIATION_REQUIRED'; END IF;
 END IF;
 RETURN target;
END $$;

-- Re-delivery may confirm an identical output, never replace a completed one.
-- Current LTX/Salad journals and export revalidation remain mutable. All other
-- resolved step values (including paid outputs and remote IDs) are immutable.
CREATE OR REPLACE FUNCTION checkpoint_video_job_v2(p_job_id uuid,p_worker text,p_progress jsonb,p_provider_job_ids jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; journal_entry record; previous jsonb; next_journal jsonb; previous_journal jsonb; kind text; field text;
BEGIN
 IF p_progress IS NULL OR jsonb_typeof(p_progress)<>'object'
 OR (p_progress ? 'steps' AND jsonb_typeof(p_progress->'steps')<>'object')
 OR (p_provider_job_ids IS NOT NULL AND jsonb_typeof(p_provider_job_ids)<>'object')
 OR (p_progress ? 'scenes' AND jsonb_typeof(p_progress->'scenes')<>'object')
 THEN RAISE EXCEPTION 'SUTRA_INVALID_CHECKPOINT'; END IF;
 SELECT * INTO j FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR p_worker IS NULL OR j.locked_by IS DISTINCT FROM p_worker
 OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp()
 THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 IF (j.progress ? 'result' AND p_progress ? 'result' AND j.progress->'result' IS DISTINCT FROM p_progress->'result')
 OR EXISTS(SELECT 1 FROM jsonb_each(coalesce(p_progress->'scenes','{}')) incoming
   WHERE coalesce(j.progress->'scenes','{}') ? incoming.key
   AND j.progress->'scenes'->incoming.key IS DISTINCT FROM incoming.value)
 OR EXISTS(SELECT 1 FROM jsonb_each(coalesce(p_progress->'steps','{}')) incoming
   WHERE incoming.key LIKE 'stage:%'
   AND j.progress->'steps'->incoming.key->>'status' IN ('complete','skipped')
   AND j.progress->'steps'->incoming.key IS DISTINCT FROM incoming.value)
 OR EXISTS(SELECT 1 FROM jsonb_each(coalesce(p_progress->'steps','{}')) incoming
   WHERE incoming.key NOT LIKE 'stage:%' AND incoming.key<>'mediaValidation'
   AND incoming.key !~ '^(scene:[0-9]+:ltx|asset:video:ltx)$'
   AND coalesce(j.progress->'steps','{}') ? incoming.key
   AND j.progress->'steps'->incoming.key IS DISTINCT FROM incoming.value)
 THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
 -- Provider ID maps are append-only; identical replay remains idempotent.
 IF EXISTS(SELECT 1 FROM jsonb_each(coalesce(p_provider_job_ids,'{}')) incoming
   WHERE j.provider_job_ids ? incoming.key
   AND j.provider_job_ids->incoming.key IS DISTINCT FROM incoming.value)
 THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
 -- Remote journals may advance, but never change provider, paid request identity,
 -- acquired remote ID or the approved Salad budget/qualification.
 FOR journal_entry IN SELECT * FROM jsonb_each(coalesce(p_progress->'steps','{}'))
   WHERE key ~ '^(scene:[0-9]+:ltx|asset:video:ltx)$'
 LOOP
  previous:=j.progress->'steps'->journal_entry.key;
  IF previous IS NULL OR previous=journal_entry.value THEN CONTINUE; END IF;
  IF jsonb_typeof(journal_entry.value) IS DISTINCT FROM 'object'
    OR (previous ? 'v2') IS DISTINCT FROM (journal_entry.value ? 'v2')
    OR (previous ? 'salad') IS DISTINCT FROM (journal_entry.value ? 'salad')
  THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
  FOREACH field IN ARRAY ARRAY['endpoint','fingerprint','started'] LOOP
   IF previous->field IS DISTINCT FROM journal_entry.value->field
   THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
  END LOOP;
  IF previous->'id' IS NOT NULL AND previous->'id'<>'null'::jsonb
    AND previous->'id' IS DISTINCT FROM journal_entry.value->'id'
  THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
  kind:=CASE WHEN previous ? 'v2' THEN 'v2' WHEN previous ? 'salad' THEN 'salad' ELSE NULL END;
  IF kind IS NULL THEN CONTINUE; END IF;
  previous_journal:=previous->kind; next_journal:=journal_entry.value->kind;
  IF jsonb_typeof(next_journal) IS DISTINCT FROM 'object'
    OR coalesce(journal_entry.value->'id','null'::jsonb) IS DISTINCT FROM coalesce(next_journal->'id','null'::jsonb)
    OR journal_entry.value->'fingerprint' IS DISTINCT FROM next_journal->'fingerprint'
  THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
  FOREACH field IN ARRAY CASE WHEN kind='v2'
    THEN ARRAY['version','provider','key','endpoint','fingerprint','model']
    ELSE ARRAY['protocol','provider','model','id','scope','fingerprint','qualificationId','quoteEvidenceSha256','timeoutMs','estimatedComputeUsd'] END
  LOOP
   IF previous_journal->field IS DISTINCT FROM next_journal->field
   THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
  END LOOP;
  IF previous_journal->'id' IS NOT NULL AND previous_journal->'id'<>'null'::jsonb
    AND previous_journal->'id' IS DISTINCT FROM next_journal->'id'
  THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
  IF previous_journal IS DISTINCT FROM next_journal THEN
   IF jsonb_typeof(previous_journal->'revision') IS DISTINCT FROM 'number'
     OR jsonb_typeof(next_journal->'revision') IS DISTINCT FROM 'number'
   THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
   IF (next_journal->>'revision')::numeric<>(previous_journal->>'revision')::numeric+1
     OR trunc((next_journal->>'revision')::numeric)<>(next_journal->>'revision')::numeric
   THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_CHECKPOINT_CONFLICT'; END IF;
  END IF;
 END LOOP;
 UPDATE video_jobs SET progress=progress || p_progress || jsonb_build_object(
   'steps',coalesce(progress->'steps','{}') || coalesce(p_progress->'steps','{}'),
   'scenes',coalesce(progress->'scenes','{}') || coalesce(p_progress->'scenes','{}')),
   provider_job_ids=provider_job_ids || coalesce(p_provider_job_ids,'{}'), updated_at=clock_timestamp()
 WHERE id=j.id;
 RETURN true;
END $$;

-- Inline and batch recovery share the same terminal exhaustion state.
CREATE OR REPLACE FUNCTION claim_video_job_by_key(p_key text,p_worker text,p_lease_seconds int)
RETURNS SETOF video_jobs LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs;
BEGIN
 SELECT * INTO j FROM video_jobs
 WHERE idempotency_key=p_key AND (status='queued' OR (status='processing' AND lease_until<clock_timestamp()))
 FOR UPDATE;
 IF j.id IS NULL THEN RETURN; END IF;
 IF j.attempts>=j.max_attempts THEN
  UPDATE video_jobs SET status='reconciliation_required',
   last_error='SUTRA_RECONCILIATION_REQUIRED: attempts exhausted',locked_by=NULL,lease_until=NULL,updated_at=clock_timestamp()
  WHERE id=j.id;
  RETURN;
 END IF;
 UPDATE video_jobs SET status='processing',attempts=attempts+1,locked_by=p_worker,
  locked_at=clock_timestamp(),lease_until=clock_timestamp()+make_interval(secs=>greatest(30,least(900,p_lease_seconds))),updated_at=clock_timestamp()
 WHERE id=j.id RETURNING * INTO j;
 RETURN NEXT j;
END $$;
COMMIT;
