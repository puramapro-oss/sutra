-- T03: apply after v10. No provider call or remote migration is made by this file.
BEGIN;
SET LOCAL search_path TO sutra, public;
ALTER TABLE video_jobs DROP CONSTRAINT IF EXISTS video_jobs_status_check;
ALTER TABLE video_jobs ADD CONSTRAINT video_jobs_status_check
 CHECK (status IN ('queued','processing','done','failed','cancelled','reconciliation_required'));

CREATE OR REPLACE FUNCTION heartbeat_video_job_v2(p_job_id uuid, p_worker text, p_lease_seconds int)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN
 UPDATE video_jobs SET lease_until=clock_timestamp()+make_interval(secs=>greatest(30,least(900,p_lease_seconds))), updated_at=clock_timestamp()
 WHERE id=p_job_id AND locked_by=p_worker AND status='processing' AND lease_until>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION checkpoint_video_job_v2(p_job_id uuid,p_worker text,p_progress jsonb,p_provider_job_ids jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN
 IF p_progress IS NULL OR jsonb_typeof(p_progress)<>'object' OR (p_progress ? 'steps' AND jsonb_typeof(p_progress->'steps')<>'object')
 OR (p_progress ? 'scenes' AND jsonb_typeof(p_progress->'scenes')<>'object') THEN
  RAISE EXCEPTION 'SUTRA_INVALID_CHECKPOINT';
 END IF;
 -- Merge sibling checkpoints atomically; concurrent voice/music/scene writes cannot erase each other.
 UPDATE video_jobs SET progress=progress || p_progress || jsonb_build_object(
   'steps',coalesce(progress->'steps','{}') || coalesce(p_progress->'steps','{}'),
   'scenes',coalesce(progress->'scenes','{}') || coalesce(p_progress->'scenes','{}')),
   provider_job_ids=provider_job_ids || coalesce(p_provider_job_ids,'{}'), updated_at=clock_timestamp()
 WHERE id=p_job_id AND locked_by=p_worker AND status='processing' AND lease_until>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION finish_video_job(p_job_id uuid,p_worker text,p_status text,p_error text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; target text;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR j.locked_by IS DISTINCT FROM p_worker OR j.lease_until<=clock_timestamp() THEN
  RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST';
 END IF;
 IF p_status NOT IN ('done','failed','queued','reconciliation_required') THEN RAISE EXCEPTION 'SUTRA_INVALID_JOB_TRANSITION'; END IF;
 IF p_status='done' AND NOT (j.progress ? 'result') THEN RAISE EXCEPTION 'SUTRA_RESULT_CHECKPOINT_REQUIRED'; END IF;
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

CREATE OR REPLACE FUNCTION claim_video_jobs(p_worker text,p_limit int,p_lease_seconds int)
RETURNS SETOF video_jobs LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN
 -- Exhausted interrupted work is retained for reconciliation; no unbounded paid retries.
 UPDATE video_jobs SET status='reconciliation_required',last_error='SUTRA_RECONCILIATION_REQUIRED: attempts exhausted',locked_by=NULL,lease_until=NULL
 WHERE attempts>=max_attempts AND (status='queued' OR (status='processing' AND lease_until<clock_timestamp()));
 RETURN QUERY WITH candidates AS (
  SELECT id FROM video_jobs WHERE attempts<max_attempts AND (status='queued' OR (status='processing' AND lease_until<clock_timestamp()))
  ORDER BY created_at LIMIT greatest(1,least(10,coalesce(p_limit,1))) FOR UPDATE SKIP LOCKED
 ) UPDATE video_jobs j SET status='processing',attempts=j.attempts+1,locked_by=p_worker,
 locked_at=clock_timestamp(),lease_until=clock_timestamp()+make_interval(secs=>greatest(30,least(900,p_lease_seconds))),updated_at=clock_timestamp()
 FROM candidates c WHERE j.id=c.id RETURNING j.*;
END $$;

-- Fenced business writes: table, columns, user and job/video binding are all checked.
CREATE OR REPLACE FUNCTION persist_video_job_video(p_job_id uuid,p_worker text,p_table text,p_id uuid,p_values jsonb,p_insert boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; cols text; sets text; vals text; changed uuid; old_url text; old_user uuid; old_status text; media jsonb; proof jsonb; final_url text; required_voice boolean; required_music boolean; stage text;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR j.locked_by IS DISTINCT FROM p_worker OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 IF p_table NOT IN ('videos','sutra_auto_videos') OR p_values IS NULL OR jsonb_typeof(p_values)<>'object' OR p_values='{}'::jsonb
 OR (p_values ? 'user_id' AND p_values->>'user_id'<>j.user_id::text) OR p_values ? 'id' THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_WRITE'; END IF;
 IF (j.kind='production' AND (p_table<>'videos' OR p_id<>j.id))
 OR (j.kind='auto' AND (p_table<>'sutra_auto_videos' OR p_id::text IS DISTINCT FROM j.payload->'input'->>'videoRowId'))
 OR (j.kind IN ('create','export') AND (p_table<>'videos' OR p_id IS DISTINCT FROM j.video_id)) THEN RAISE EXCEPTION 'SUTRA_VIDEO_OWNER_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_values) k WHERE k NOT IN (
 'user_id','title','description','tags','script_data','voice_url','music_url','video_url','thumbnail_url','shotstack_json','duration','status','quality','cost_estimate','format',
 'script','theme_id','prompt_used','music_prompt','ai_reasoning','ai_confidence','video_raw_url','video_final_url','audio_music_url','audio_voice_url','error_message','generation_completed_at','generation_duration_seconds','hashtags')) THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_COLUMN'; END IF;
 -- Ready requires the durable measured final export and every requested track.
 IF p_values->>'status' IN ('ready','pending_approval') THEN
  media:=j.progress->'steps'->'stage:export'->'value'; proof:=media->'verification';
  final_url:=coalesce(p_values->>'video_url',p_values->>'video_final_url');
  IF final_url IS NULL OR NOT coalesce((media->>'outputVerified')::boolean,false)
   OR proof->>'url' IS DISTINCT FROM final_url OR media->>'url' IS DISTINCT FROM final_url
   OR coalesce(proof->>'sha256','') !~ '^[a-f0-9]{64}$'
   OR NOT coalesce((proof->>'duration')::numeric>0 AND (proof->>'fps')::numeric>0
    AND (proof->>'width')::int=(media->'outputSize'->>'width')::int
    AND (proof->>'height')::int=(media->'outputSize'->>'height')::int
    AND abs((proof->>'duration')::numeric-(media->>'duration')::numeric)<=0.1,false)
   THEN RAISE EXCEPTION 'SUTRA_FINAL_MEDIA_PROOF_REQUIRED'; END IF;
  FOREACH stage IN ARRAY ARRAY['script','scenes','images','voice','music','subtitles','composition','export'] LOOP
   IF NOT coalesce(j.progress->'steps' ? ('stage:'||stage),false) THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: %',stage; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(j.progress->'steps'->'stage:scenes'->'value') clip
   WHERE coalesce(clip->>'url',clip#>>'{}')=final_url) OR p_values->>'video_raw_url'=final_url
   THEN RAISE EXCEPTION 'SUTRA_RAW_MEDIA_FORBIDDEN'; END IF;
  required_voice:=CASE WHEN j.kind='auto' THEN coalesce((j.payload->'input'->'config'->>'default_voice_enabled')::boolean,false)
   WHEN j.kind='export' THEN coalesce((j.payload->'input'->'requiredTracks'->>'voice')::boolean,true)
   ELSE coalesce(j.progress->'steps'->'stage:script'->'value'->>'narration','')<>'' END;
  required_music:=CASE WHEN j.kind='auto' THEN coalesce(j.payload->'input'->'config'->>'default_music_genre','none') NOT IN ('','none')
   WHEN j.kind='export' THEN coalesce((j.payload->'input'->'requiredTracks'->>'music')::boolean,true)
   WHEN j.kind='create' THEN coalesce(j.progress->'steps'->'stage:script'->'value'->>'music_style','none') NOT IN ('','none')
   ELSE coalesce(j.payload->'input'->>'musicStyle','cinematic')<>'none' END;
  IF required_voice AND coalesce(j.progress->'steps'->'stage:voice'->>'value','') IN ('','null')
   OR required_music AND coalesce(j.progress->'steps'->'stage:music'->>'value','') IN ('','null')
   OR (required_voice OR required_music) AND NOT coalesce((proof->>'hasAudio')::boolean,false)
   THEN RAISE EXCEPTION 'SUTRA_REQUIRED_TRACK_MISSING'; END IF;
 END IF;
 -- Publication owns these states: replay may acknowledge the same final file only.
 EXECUTE format('SELECT %I,user_id,status FROM sutra.%I WHERE id=$1 FOR UPDATE',
   CASE WHEN p_table='videos' THEN 'video_url' ELSE 'video_final_url' END,p_table)
   INTO old_url,old_user,old_status USING p_id;
 IF old_user IS NOT NULL AND old_user<>j.user_id THEN RAISE EXCEPTION 'SUTRA_VIDEO_OWNER_MISMATCH'; END IF;
 IF old_status IN ('publishing','published','scheduled','partially_published','reconciliation_required','cancelled') THEN
  IF final_url=old_url AND old_status<>'cancelled' THEN RETURN true; END IF;
  RAISE EXCEPTION 'SUTRA_PUBLISHED_VIDEO_IMMUTABLE';
 END IF;
 SELECT string_agg(format('%I',k),','),string_agg(format('%I=r.%I',k,k),','),string_agg(format('r.%I',k),',') INTO cols,sets,vals FROM jsonb_object_keys(p_values) k;
 IF p_insert THEN
  EXECUTE format('INSERT INTO sutra.%I(id,%s) SELECT $1,%s FROM jsonb_populate_record(NULL::sutra.%I,$2) r ON CONFLICT(id) DO NOTHING RETURNING id',p_table,cols,vals,p_table) INTO changed USING p_id,p_values;
  IF changed IS NULL AND (old_user IS DISTINCT FROM j.user_id OR old_url IS DISTINCT FROM p_values->>'video_url') THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: conflicting video'; END IF;
 ELSE
  EXECUTE format('UPDATE sutra.%I v SET %s FROM jsonb_populate_record(NULL::sutra.%I,$2) r WHERE v.id=$1 AND v.user_id=$3 RETURNING v.id',p_table,sets,p_table) INTO changed USING p_id,p_values,j.user_id;
  IF changed IS NULL THEN RAISE EXCEPTION 'SUTRA_VIDEO_PERSISTENCE_FAILED'; END IF;
 END IF;
 -- Preserve AUTO memory/theme side effects exactly once in the same transaction.
 IF j.kind='auto' AND p_values->>'status' IN ('ready','pending_approval') AND NOT coalesce((j.progress->>'auto_effects_saved')::boolean,false) THEN
  INSERT INTO sutra_auto_memory(user_id,memory_type,content,importance,related_video_id)
   VALUES(j.user_id,'preference',format('Video generee: "%s" — theme: %s, raison: %s',p_values->>'title',coalesce(p_values->>'theme_id','libre'),p_values->>'ai_reasoning'),0.5,p_id);
  IF p_values->>'theme_id' IS NOT NULL THEN
   UPDATE sutra_auto_themes SET times_used=coalesce(times_used,0)+1,last_used_at=clock_timestamp()
    WHERE id=(p_values->>'theme_id')::uuid AND user_id=j.user_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_THEME_OWNER_MISMATCH'; END IF;
  END IF;
  UPDATE video_jobs SET progress=progress||'{"auto_effects_saved":true}'::jsonb WHERE id=j.id;
 END IF;
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION record_video_job_event(p_job_id uuid,p_worker text,p_table text,p_key text,p_values jsonb)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; cols text; vals text; receipt uuid;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR j.locked_by IS DISTINCT FROM p_worker OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 IF p_table NOT IN ('api_logs','activity_logs','user_notifications') OR p_key IS NULL OR p_values IS NULL
  OR jsonb_typeof(p_values)<>'object' OR p_values->>'user_id' IS DISTINCT FROM j.user_id::text
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_values) k WHERE k NOT IN ('user_id','service','endpoint','status','response_time_ms','error_message','type','title','message','description','metadata'))
  THEN RAISE EXCEPTION 'SUTRA_INVALID_EVENT'; END IF;
 IF coalesce(j.progress->'effects','{}') ? (p_table||':'||p_key) THEN RETURN true; END IF;
 SELECT string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') INTO cols,vals FROM jsonb_object_keys(p_values) k;
 EXECUTE format('INSERT INTO sutra.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::sutra.%I,$1) r RETURNING id',p_table,cols,vals,p_table) INTO receipt USING p_values;
 IF receipt IS NULL THEN RAISE EXCEPTION 'SUTRA_EVENT_PERSISTENCE_FAILED'; END IF;
 UPDATE video_jobs SET progress=jsonb_set(progress,'{effects}',coalesce(progress->'effects','{}')||jsonb_build_object(p_table||':'||p_key,receipt)) WHERE id=j.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION record_video_job_event(uuid,text,text,text,jsonb) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT EXECUTE ON FUNCTION record_video_job_event(uuid,text,text,text,jsonb) TO service_role;
 END IF;
END $$;

REVOKE ALL ON FUNCTION heartbeat_video_job_v2(uuid,text,int),checkpoint_video_job_v2(uuid,text,jsonb,jsonb),finish_video_job(uuid,text,text,text),persist_video_job_video(uuid,text,text,uuid,jsonb,boolean) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT EXECUTE ON FUNCTION heartbeat_video_job_v2(uuid,text,int),checkpoint_video_job_v2(uuid,text,jsonb,jsonb),finish_video_job(uuid,text,text,text),persist_video_job_video(uuid,text,text,uuid,jsonb,boolean) TO service_role;
 END IF;
END $$;
-- Old RPC names retain their return type but cannot bypass the new fence.
CREATE OR REPLACE FUNCTION heartbeat_video_job(p_job_id uuid,p_worker text,p_lease_seconds int)
RETURNS void LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN PERFORM heartbeat_video_job_v2(p_job_id,p_worker,p_lease_seconds); END $$;
CREATE OR REPLACE FUNCTION checkpoint_video_job(p_job_id uuid,p_worker text,p_progress jsonb,p_provider_job_ids jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN PERFORM checkpoint_video_job_v2(p_job_id,p_worker,p_progress,p_provider_job_ids); END $$;

CREATE OR REPLACE FUNCTION cancel_video_job(p_key text)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE idempotency_key=p_key AND status IN ('queued','processing','reconciliation_required') FOR UPDATE;
 IF j.id IS NULL THEN RETURN false; END IF;
 UPDATE video_quota_counters SET reserved=reserved-1,released=released+1,updated_at=clock_timestamp()
  WHERE user_id=j.user_id AND period_start=date_trunc('month',j.created_at)::date AND reserved>0;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_QUOTA_RECONCILIATION_REQUIRED'; END IF;
 UPDATE video_jobs SET status='cancelled',locked_by=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=j.id;
 RETURN true;
END $$;
-- Serialize same-intent submissions before quota, video and queue writes.
ALTER TABLE video_jobs ADD COLUMN IF NOT EXISTS request_hash text;
CREATE OR REPLACE FUNCTION submit_video_job(p_user_id uuid,p_kind text,p_video_id uuid,p_payload jsonb,p_key text,p_request_hash text,p_limit int,p_initial jsonb)
RETURNS SETOF video_jobs LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; target_id uuid; target_table text; initial jsonb; cols text; vals text; receipt uuid;
BEGIN
 IF p_user_id IS NULL OR p_kind NOT IN ('create','production','auto','export') OR p_key IS NULL OR length(p_key)>512
  OR p_request_hash IS NULL OR p_request_hash !~ '^[a-f0-9]{64}$' OR p_limit IS NULL
  OR p_payload->'input'->>'userId' IS DISTINCT FROM p_user_id::text THEN RAISE EXCEPTION 'SUTRA_INVALID_SUBMISSION'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_key,0));
 SELECT * INTO j FROM video_jobs WHERE idempotency_key=p_key;
 IF j.id IS NOT NULL THEN
  IF j.user_id<>p_user_id OR j.kind<>p_kind OR j.request_hash IS DISTINCT FROM p_request_hash THEN
   RAISE EXCEPTION 'SUTRA_IDEMPOTENCY_CONFLICT';
  END IF;
  RETURN NEXT j; RETURN;
 END IF;
 IF p_kind IN ('create','export') AND (p_video_id IS NULL OR p_payload->'input'->>'videoId' IS DISTINCT FROM p_video_id::text)
  OR p_kind IN ('auto','production') AND p_video_id IS NOT NULL THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_BINDING'; END IF;
 IF p_kind='export' AND NOT EXISTS(SELECT 1 FROM videos WHERE id=p_video_id AND user_id=p_user_id) THEN RAISE EXCEPTION 'SUTRA_VIDEO_OWNER_MISMATCH'; END IF;
 IF NOT reserve_video_quota(p_user_id,p_limit) THEN RAISE EXCEPTION 'SUTRA_QUOTA_EXHAUSTED'; END IF;
 IF p_kind IN ('create','auto') THEN
  IF p_initial IS NULL OR jsonb_typeof(p_initial)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_initial) k
    WHERE k NOT IN ('format','quality','tags','media_mode','stock_sources','schedule_id','scheduled_for','generation_started_at')) THEN RAISE EXCEPTION 'SUTRA_INVALID_INITIAL_VIDEO'; END IF;
  target_id:=CASE WHEN p_kind='create' THEN p_video_id ELSE (p_payload->'input'->>'videoRowId')::uuid END;
  IF target_id IS NULL THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_BINDING'; END IF;
  target_table:=CASE WHEN p_kind='create' THEN 'videos' ELSE 'sutra_auto_videos' END;
  initial:=p_initial||jsonb_build_object('id',target_id,'user_id',p_user_id,'status',CASE WHEN p_kind='create' THEN 'generating' ELSE 'planning' END);
  SELECT string_agg(format('%I',k),','),string_agg(format('r.%I',k),',') INTO cols,vals FROM jsonb_object_keys(initial) k;
  EXECUTE format('INSERT INTO sutra.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::sutra.%I,$1) r RETURNING id',target_table,cols,vals,target_table) INTO receipt USING initial;
  IF receipt IS DISTINCT FROM target_id THEN RAISE EXCEPTION 'SUTRA_VIDEO_PERSISTENCE_FAILED'; END IF;
 ELSIF p_initial IS NOT NULL THEN RAISE EXCEPTION 'SUTRA_INVALID_INITIAL_VIDEO'; END IF;
 INSERT INTO video_jobs(user_id,kind,video_id,payload,idempotency_key,request_hash)
  VALUES(p_user_id,p_kind,p_video_id,p_payload,p_key,p_request_hash) RETURNING * INTO j;
 RETURN NEXT j;
END $$;
REVOKE ALL ON FUNCTION submit_video_job(uuid,text,uuid,jsonb,text,text,int,jsonb) FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
  GRANT EXECUTE ON FUNCTION submit_video_job(uuid,text,uuid,jsonb,text,text,int,jsonb) TO service_role;
 END IF;
END $$;
COMMIT;
