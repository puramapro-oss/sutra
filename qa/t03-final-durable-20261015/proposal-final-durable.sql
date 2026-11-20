-- PROPOSAL FOR T01 ONLY. No remote execution; validated in a private disposable database.
-- Retains current function ACLs. New helper is pure and not available to PUBLIC.
BEGIN;
SET LOCAL search_path TO sutra, public;

CREATE OR REPLACE FUNCTION video_job_result_valid(j video_jobs)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = sutra, pg_temp AS $$
DECLARE result jsonb:=j.progress->'result'; steps jsonb:=j.progress->'steps'; input jsonb:=j.payload->'input';
 stage text; output text; media jsonb; proof jsonb; final_url text; required_voice boolean; required_music boolean; p_values jsonb;
BEGIN
 IF result IS NULL THEN RETURN false; END IF;
 IF result='null'::jsonb THEN RETURN coalesce(j.kind='production' AND input->>'step'='music' AND input->>'musicStyle'='none'
   AND steps->'stage:music'->>'status'='skipped' AND steps->'stage:music'->'value'='null'::jsonb,false); END IF;
 IF j.kind='production' AND input->>'step' IN ('script','video','voice','music') THEN
  stage:=CASE input->>'step' WHEN 'video' THEN 'scenes' ELSE input->>'step' END;
  IF steps->('stage:'||stage)->>'status' IS DISTINCT FROM 'complete' THEN RETURN false; END IF;
  IF stage='voice' THEN RETURN coalesce(jsonb_typeof(result)='object' AND jsonb_typeof(result->'url')='string'
   AND result->>'url' ~ '[^[:space:]]' AND result->>'url'<>'null' AND result->'url'=steps->'stage:voice'->'value',false); END IF;
  IF stage='music' THEN RETURN coalesce(jsonb_typeof(result)='string' AND result#>>'{}' ~ '[^[:space:]]'
   AND result#>>'{}'<>'null' AND result=steps->'stage:music'->'value',false); END IF;
  IF stage='scenes' THEN
   IF jsonb_typeof(result)<>'array' THEN RETURN false; END IF;
   RETURN jsonb_array_length(result)>0 AND result=steps->'stage:scenes'->'value' AND NOT EXISTS(
    SELECT 1 FROM jsonb_array_elements(result) scene WHERE jsonb_typeof(scene->'url') IS DISTINCT FROM 'string'
     OR scene->>'url'='null' OR NOT coalesce(scene->>'url' ~ '[^[:space:]]',false));
  END IF;
  IF jsonb_typeof(result)<>'object' OR jsonb_typeof(result->'scenes') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  RETURN jsonb_array_length(result->'scenes')>0 AND result=steps->'stage:script'->'value';
 END IF;
 IF j.kind='production' AND coalesce(input->>'step','') NOT IN ('all','assembly') THEN RETURN false; END IF;
 IF jsonb_typeof(result)<>'object' THEN RETURN false; END IF;
 IF j.kind='auto' AND (coalesce(result->>'status','') NOT IN ('ready','pending_approval')
   OR result->'assemblyError' IS DISTINCT FROM 'null'::jsonb) THEN RETURN false; END IF;
 output:=CASE j.kind WHEN 'create' THEN result->>'videoUrl' WHEN 'auto' THEN result->>'videoFinalUrl'
   WHEN 'production' THEN CASE WHEN input->>'step'='all' THEN result->'assembly'->>'url' ELSE result->>'url' END
   WHEN 'export' THEN result->>'url' END;
 p_values:=jsonb_build_object('video_url',output);
  media:=j.progress->'steps'->'stage:export'->'value'; proof:=media->'verification';
  final_url:=coalesce(p_values->>'video_url',p_values->>'video_final_url');
  IF NOT coalesce(final_url ~ '[^[:space:]]',false) OR media->'outputVerified' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(media->'url') IS DISTINCT FROM 'string' OR jsonb_typeof(proof->'url') IS DISTINCT FROM 'string'
   OR proof->>'url' IS DISTINCT FROM final_url OR media->>'url' IS DISTINCT FROM final_url
   OR coalesce(proof->>'sha256','') !~ '^[a-f0-9]{64}$'
   OR jsonb_typeof(media->'duration') IS DISTINCT FROM 'number'
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['width','height']) field
    WHERE jsonb_typeof(media->'outputSize'->field) IS DISTINCT FROM 'number')
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['duration','fps','width','height']) field
    WHERE jsonb_typeof(proof->field) IS DISTINCT FROM 'number')
   OR NOT coalesce((media->>'duration')::numeric>0 AND (proof->>'duration')::numeric>0 AND (proof->>'fps')::numeric>0
    AND (proof->>'width')::int>0 AND (proof->>'height')::int>0
    AND (proof->>'width')::int=(media->'outputSize'->>'width')::int
    AND (proof->>'height')::int=(media->'outputSize'->>'height')::int
    AND abs((proof->>'duration')::numeric-(media->>'duration')::numeric)<=0.1,false)
   THEN RAISE EXCEPTION 'SUTRA_FINAL_MEDIA_PROOF_REQUIRED'; END IF;
  FOREACH stage IN ARRAY ARRAY['script','scenes','images','voice','music','subtitles','composition','export'] LOOP
   IF NOT coalesce(j.progress->'steps'->('stage:'||stage)->>'status' IN ('complete','skipped'),false)
    OR (stage IN ('scenes','composition','export') AND j.progress->'steps'->('stage:'||stage)->>'status'<>'complete')
    THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: %',stage; END IF;
  END LOOP;
  IF jsonb_typeof(j.progress->'steps'->'stage:scenes'->'value') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: scenes'; END IF;
  IF jsonb_array_length(j.progress->'steps'->'stage:scenes'->'value')=0
   THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: scenes'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(steps->'stage:scenes'->'value') clip
   WHERE CASE WHEN jsonb_typeof(clip)='string' THEN clip#>>'{}'
    WHEN jsonb_typeof(clip)='object' AND jsonb_typeof(clip->'url')='string' THEN clip->>'url' END IS NULL
    OR coalesce(clip->>'url',clip#>>'{}')='null'
    OR NOT coalesce(coalesce(clip->>'url',clip#>>'{}') ~ '[^[:space:]]',false)) THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(j.progress->'steps'->'stage:scenes'->'value') clip
   WHERE coalesce(clip->>'url',clip#>>'{}')=final_url) OR p_values->>'video_raw_url'=final_url
   THEN RAISE EXCEPTION 'SUTRA_RAW_MEDIA_FORBIDDEN'; END IF;
  required_voice:=CASE WHEN j.kind='auto' THEN coalesce((j.payload->'input'->'config'->>'default_voice_enabled')::boolean,false)
   WHEN j.kind='export' THEN coalesce((j.payload->'input'->'requiredTracks'->>'voice')::boolean,true)
   ELSE coalesce(j.progress->'steps'->'stage:script'->'value'->>'narration' ~ '[^[:space:]]',false) END;
  required_music:=CASE WHEN j.kind='auto' THEN coalesce(j.payload->'input'->'config'->>'default_music_genre','none') NOT IN ('','none')
   WHEN j.kind='export' THEN coalesce((j.payload->'input'->'requiredTracks'->>'music')::boolean,true)
   WHEN j.kind='create' THEN coalesce(j.progress->'steps'->'stage:script'->'value'->>'music_style','none') NOT IN ('','none')
   ELSE coalesce(j.payload->'input'->>'musicStyle','cinematic')<>'none' END;
  IF required_voice AND (j.progress->'steps'->'stage:voice'->>'status' IS DISTINCT FROM 'complete'
    OR jsonb_typeof(j.progress->'steps'->'stage:voice'->'value') IS DISTINCT FROM 'string'
    OR j.progress->'steps'->'stage:voice'->>'value'='null'
    OR NOT coalesce(j.progress->'steps'->'stage:voice'->>'value' ~ '[^[:space:]]',false))
   OR required_music AND (j.progress->'steps'->'stage:music'->>'status' IS DISTINCT FROM 'complete'
    OR jsonb_typeof(j.progress->'steps'->'stage:music'->'value') IS DISTINCT FROM 'string'
    OR j.progress->'steps'->'stage:music'->>'value'='null'
    OR NOT coalesce(j.progress->'steps'->'stage:music'->>'value' ~ '[^[:space:]]',false))
   OR (required_voice OR required_music) AND proof->'hasAudio' IS DISTINCT FROM 'true'::jsonb
   THEN RAISE EXCEPTION 'SUTRA_REQUIRED_TRACK_MISSING'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['voice','music']) track
   WHERE jsonb_typeof(steps->('stage:'||track)->'value')='string'
    AND steps->('stage:'||track)->>'value'<>'null'
    AND steps->('stage:'||track)->>'value' ~ '[^[:space:]]')
   AND proof->'hasAudio' IS DISTINCT FROM 'true'::jsonb THEN RETURN false; END IF;
 RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false; -- Invalid JSON/numeric contract is not a successful receipt.
END $$;
REVOKE ALL ON FUNCTION video_job_result_valid(video_jobs) FROM PUBLIC;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
 GRANT EXECUTE ON FUNCTION video_job_result_valid(video_jobs) TO service_role;
END IF; END $$;

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
 IF p_status='done' AND NOT video_job_result_valid(j) THEN RAISE EXCEPTION 'SUTRA_RECONCILIATION_REQUIRED: SUTRA_RESULT_CHECKPOINT_REQUIRED'; END IF;
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

CREATE OR REPLACE FUNCTION claim_video_job_by_key(p_key text,p_worker text,p_lease_seconds int)
RETURNS SETOF video_jobs LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs;
BEGIN
 SELECT * INTO j FROM video_jobs
 WHERE idempotency_key=p_key AND ((status='queued' AND (attempts=0 OR updated_at + make_interval(secs=>least(900,30*power(2,least(5,greatest(0,attempts-1))))::int) <= clock_timestamp())) OR (status='processing' AND lease_until<clock_timestamp()))
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

CREATE OR REPLACE FUNCTION claim_video_jobs(p_worker text,p_limit int,p_lease_seconds int)
RETURNS SETOF video_jobs LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
BEGIN
 -- Exhausted interrupted work is retained for reconciliation; no unbounded paid retries.
 UPDATE video_jobs SET status='reconciliation_required',last_error='SUTRA_RECONCILIATION_REQUIRED: attempts exhausted',locked_by=NULL,lease_until=NULL
 WHERE attempts>=max_attempts AND (status='queued' OR (status='processing' AND lease_until<clock_timestamp()));
 RETURN QUERY WITH candidates AS (
  SELECT id FROM video_jobs WHERE attempts<max_attempts AND ((status='queued' AND (attempts=0 OR updated_at + make_interval(secs=>least(900,30*power(2,least(5,greatest(0,attempts-1))))::int) <= clock_timestamp())) OR (status='processing' AND lease_until<clock_timestamp()))
  ORDER BY created_at LIMIT greatest(1,least(10,coalesce(p_limit,1))) FOR UPDATE SKIP LOCKED
 ) UPDATE video_jobs j SET status='processing',attempts=j.attempts+1,locked_by=p_worker,
 locked_at=clock_timestamp(),lease_until=clock_timestamp()+make_interval(secs=>greatest(30,least(900,p_lease_seconds))),updated_at=clock_timestamp()
 FROM candidates c WHERE j.id=c.id RETURNING j.*;
END $$;

CREATE OR REPLACE FUNCTION persist_video_job_video(p_job_id uuid,p_worker text,p_table text,p_id uuid,p_values jsonb,p_insert boolean DEFAULT false)
RETURNS boolean LANGUAGE plpgsql SET search_path = sutra, pg_temp AS $$
DECLARE j video_jobs; cols text; sets text; vals text; changed uuid; old_url text; old_user uuid; old_status text; media jsonb; proof jsonb; final_url text; required_voice boolean; required_music boolean; stage text;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE id=p_job_id FOR UPDATE;
 IF j.id IS NULL OR j.status<>'processing' OR p_worker IS NULL OR j.locked_by IS DISTINCT FROM p_worker
  OR j.lease_until IS NULL OR j.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'SUTRA_JOB_LEASE_LOST'; END IF;
 IF p_table NOT IN ('videos','sutra_auto_videos') OR p_values IS NULL OR jsonb_typeof(p_values)<>'object' OR p_values='{}'::jsonb
 OR (p_values ? 'user_id' AND p_values->>'user_id'<>j.user_id::text) OR p_values ? 'id' THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_WRITE'; END IF;
 IF (j.kind='production' AND (p_table<>'videos' OR p_id<>j.id))
 OR (j.kind='auto' AND (p_table<>'sutra_auto_videos' OR p_id::text IS DISTINCT FROM j.payload->'input'->>'videoRowId'))
 OR (j.kind IN ('create','export') AND (p_table<>'videos' OR p_id IS DISTINCT FROM j.video_id)) THEN RAISE EXCEPTION 'SUTRA_VIDEO_OWNER_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_values) k WHERE k NOT IN (
 'user_id','title','description','tags','script_data','voice_url','music_url','video_url','thumbnail_url','shotstack_json','duration','status','quality','cost_estimate','format',
 'script','theme_id','prompt_used','music_prompt','ai_reasoning','ai_confidence','video_raw_url','video_final_url','audio_music_url','audio_voice_url','error_message','generation_completed_at','generation_duration_seconds','hashtags')) THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_COLUMN'; END IF;
 -- Generation owns only generation states. Social transitions belong to their own fenced journal.
 IF p_values ? 'status' AND NOT coalesce(CASE WHEN p_table='videos'
  THEN p_values->>'status' IN ('draft','generating','ready','failed')
  ELSE p_values->>'status' IN ('planning','generating_script','generating_video','generating_audio','compositing','ready','pending_approval','failed') END,false)
 THEN RAISE EXCEPTION 'SUTRA_INVALID_VIDEO_TRANSITION'; END IF;
 -- Ready requires the durable measured final export and every requested track.
 IF p_values->>'status' IN ('ready','pending_approval') THEN
  media:=j.progress->'steps'->'stage:export'->'value'; proof:=media->'verification';
  final_url:=coalesce(p_values->>'video_url',p_values->>'video_final_url');
  IF NOT coalesce(final_url ~ '[^[:space:]]',false) OR media->'outputVerified' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(media->'url') IS DISTINCT FROM 'string' OR jsonb_typeof(proof->'url') IS DISTINCT FROM 'string'
   OR proof->>'url' IS DISTINCT FROM final_url OR media->>'url' IS DISTINCT FROM final_url
   OR coalesce(proof->>'sha256','') !~ '^[a-f0-9]{64}$'
   OR jsonb_typeof(media->'duration') IS DISTINCT FROM 'number'
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['width','height']) field
    WHERE jsonb_typeof(media->'outputSize'->field) IS DISTINCT FROM 'number')
   OR EXISTS(SELECT 1 FROM unnest(ARRAY['duration','fps','width','height']) field
    WHERE jsonb_typeof(proof->field) IS DISTINCT FROM 'number')
   OR NOT coalesce((media->>'duration')::numeric>0 AND (proof->>'duration')::numeric>0 AND (proof->>'fps')::numeric>0
    AND (proof->>'width')::int>0 AND (proof->>'height')::int>0
    AND (proof->>'width')::int=(media->'outputSize'->>'width')::int
    AND (proof->>'height')::int=(media->'outputSize'->>'height')::int
    AND abs((proof->>'duration')::numeric-(media->>'duration')::numeric)<=0.1,false)
   THEN RAISE EXCEPTION 'SUTRA_FINAL_MEDIA_PROOF_REQUIRED'; END IF;
  FOREACH stage IN ARRAY ARRAY['script','scenes','images','voice','music','subtitles','composition','export'] LOOP
   IF NOT coalesce(j.progress->'steps'->('stage:'||stage)->>'status' IN ('complete','skipped'),false)
    OR (stage IN ('scenes','composition','export') AND j.progress->'steps'->('stage:'||stage)->>'status'<>'complete')
    THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: %',stage; END IF;
  END LOOP;
  IF jsonb_typeof(j.progress->'steps'->'stage:scenes'->'value') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: scenes'; END IF;
  IF jsonb_array_length(j.progress->'steps'->'stage:scenes'->'value')=0
   THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: scenes'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(j.progress->'steps'->'stage:scenes'->'value') clip
   WHERE CASE WHEN jsonb_typeof(clip)='string' THEN clip#>>'{}'
    WHEN jsonb_typeof(clip)='object' AND jsonb_typeof(clip->'url')='string' THEN clip->>'url' END IS NULL
    OR coalesce(clip->>'url',clip#>>'{}')='null'
    OR NOT coalesce(coalesce(clip->>'url',clip#>>'{}') ~ '[^[:space:]]',false)) THEN RAISE EXCEPTION 'SUTRA_STAGE_CHECKPOINT_REQUIRED: scenes'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(j.progress->'steps'->'stage:scenes'->'value') clip
   WHERE coalesce(clip->>'url',clip#>>'{}')=final_url) OR p_values->>'video_raw_url'=final_url
   THEN RAISE EXCEPTION 'SUTRA_RAW_MEDIA_FORBIDDEN'; END IF;
  required_voice:=CASE WHEN j.kind='auto' THEN coalesce((j.payload->'input'->'config'->>'default_voice_enabled')::boolean,false)
   WHEN j.kind='export' THEN coalesce((j.payload->'input'->'requiredTracks'->>'voice')::boolean,true)
   ELSE coalesce(j.progress->'steps'->'stage:script'->'value'->>'narration' ~ '[^[:space:]]',false) END;
  required_music:=CASE WHEN j.kind='auto' THEN coalesce(j.payload->'input'->'config'->>'default_music_genre','none') NOT IN ('','none')
   WHEN j.kind='export' THEN coalesce((j.payload->'input'->'requiredTracks'->>'music')::boolean,true)
   WHEN j.kind='create' THEN coalesce(j.progress->'steps'->'stage:script'->'value'->>'music_style','none') NOT IN ('','none')
   ELSE coalesce(j.payload->'input'->>'musicStyle','cinematic')<>'none' END;
  IF required_voice AND (j.progress->'steps'->'stage:voice'->>'status' IS DISTINCT FROM 'complete'
    OR jsonb_typeof(j.progress->'steps'->'stage:voice'->'value') IS DISTINCT FROM 'string'
    OR j.progress->'steps'->'stage:voice'->>'value'='null'
    OR NOT coalesce(j.progress->'steps'->'stage:voice'->>'value' ~ '[^[:space:]]',false))
   OR required_music AND (j.progress->'steps'->'stage:music'->>'status' IS DISTINCT FROM 'complete'
    OR jsonb_typeof(j.progress->'steps'->'stage:music'->'value') IS DISTINCT FROM 'string'
    OR j.progress->'steps'->'stage:music'->>'value'='null'
    OR NOT coalesce(j.progress->'steps'->'stage:music'->>'value' ~ '[^[:space:]]',false))
   OR (required_voice OR required_music) AND proof->'hasAudio' IS DISTINCT FROM 'true'::jsonb
   THEN RAISE EXCEPTION 'SUTRA_REQUIRED_TRACK_MISSING'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['voice','music']) track
   WHERE jsonb_typeof(j.progress->'steps'->('stage:'||track)->'value')='string'
    AND j.progress->'steps'->('stage:'||track)->>'value'<>'null'
    AND j.progress->'steps'->('stage:'||track)->>'value' ~ '[^[:space:]]')
   AND proof->'hasAudio' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'SUTRA_REQUIRED_TRACK_MISSING'; END IF;
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
COMMIT;
