-- R107. Apply AFTER sutra_auto, occurrence integrity, v10/v11 and final durable.
-- Proposed only: no historical backfill. Existing configurations start at this
-- installation's time. Rollout must explicitly account for any earlier outage.
BEGIN;
SET LOCAL search_path TO sutra, pg_temp;
ALTER TABLE sutra.sutra_auto_config ADD COLUMN IF NOT EXISTS scheduler_cursor timestamptz NOT NULL DEFAULT now();

-- Refuse to overwrite a newer/unrecognised implementation on replay.
DO $$ DECLARE signature text; object_id regprocedure; BEGIN
  FOREACH signature IN ARRAY ARRAY['sutra.t03_reset_auto_cursor()',
    'sutra.schedule_auto_video_jobs(uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone,jsonb,integer)'] LOOP
    object_id := to_regprocedure(signature);
    IF object_id IS NOT NULL AND obj_description(object_id, 'pg_proc') IS DISTINCT FROM
      'T03_AUTO_SCHEDULER_V1:' || md5(pg_get_functiondef(object_id)) THEN
      RAISE EXCEPTION 'SUTRA_SCHEDULER_DEFINITION_DRIFT';
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION sutra.t03_reset_auto_cursor() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- A new/edited/reactivated schedule starts a new calendar, not an implicit
  -- retroactive purchase. Already materialised jobs/checkpoints are untouched.
  IF TG_OP = 'INSERT' THEN
    -- Historical client INSERT grants must not allow a retroactive calendar.
    NEW.scheduler_cursor := clock_timestamp();
  ELSIF NEW.schedules IS DISTINCT FROM OLD.schedules OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.scheduler_cursor := clock_timestamp();
  ELSIF NEW.scheduler_cursor IS DISTINCT FROM OLD.scheduler_cursor AND
    current_user <> 'service_role' AND current_user <> pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid=TG_RELID)) THEN
    RAISE EXCEPTION 'SUTRA_SCHEDULER_CURSOR_FORBIDDEN';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS t03_auto_cursor ON sutra.sutra_auto_config;
CREATE TRIGGER t03_auto_cursor BEFORE INSERT OR UPDATE ON sutra.sutra_auto_config
FOR EACH ROW EXECUTE FUNCTION sutra.t03_reset_auto_cursor();

CREATE OR REPLACE FUNCTION sutra.schedule_auto_video_jobs(
  p_user_id uuid, p_from timestamptz, p_through timestamptz, p_updated_at timestamptz, p_jobs jsonb, p_limit int
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = sutra, pg_temp AS $$
DECLARE config sutra.sutra_auto_config; item jsonb; job sutra.video_jobs; jobs jsonb := '[]'; occurrence timestamptz; saved_cursor timestamptz;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'SUTRA_SCHEDULER_ISOLATION';
  END IF;
  IF p_from IS NULL OR p_through IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_through)
    OR p_through <= p_from OR p_through - p_from > interval '24 hours'
    OR p_updated_at IS NULL OR p_jobs IS NULL OR jsonb_typeof(p_jobs) <> 'array' OR p_limit IS NULL THEN
    RAISE EXCEPTION 'SUTRA_INVALID_SCHEDULING_WINDOW';
  END IF;
  SELECT * INTO config FROM sutra.sutra_auto_config WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR config.is_active IS DISTINCT FROM true OR config.scheduler_cursor IS DISTINCT FROM p_from
    OR config.updated_at IS DISTINCT FROM p_updated_at THEN RAISE EXCEPTION 'SUTRA_SCHEDULE_CONFLICT'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_jobs) LOOP
    occurrence := (item->'initial'->>'scheduled_for')::timestamptz;
    IF occurrence IS NULL OR occurrence <= p_from OR occurrence > p_through
      OR item->'input'->>'userId' IS DISTINCT FROM p_user_id::text
      OR item->'input'->>'scheduleId' IS DISTINCT FROM item->'initial'->>'schedule_id'
      OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(config.schedules) s
        WHERE s->>'id'=item->'initial'->>'schedule_id' AND s->>'is_active'='true') THEN
      RAISE EXCEPTION 'SUTRA_INVALID_SCHEDULE_OCCURRENCE';
    END IF;
    SELECT * INTO STRICT job FROM sutra.submit_video_job(p_user_id,'auto',NULL,
      jsonb_build_object('input',jsonb_set(item->'input','{config}',to_jsonb(config))),
      item->>'key',item->>'fingerprint',p_limit,item->'initial');
    jobs := jobs || to_jsonb(job);
  END LOOP;
  UPDATE sutra.sutra_auto_config SET scheduler_cursor=p_through WHERE id=config.id RETURNING scheduler_cursor INTO saved_cursor;
  IF NOT FOUND OR saved_cursor IS DISTINCT FROM p_through THEN RAISE EXCEPTION 'SUTRA_SCHEDULER_PERSISTENCE_FAILED'; END IF;
  RETURN jsonb_build_object('cursor',to_char(p_through AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'jobs',jobs);
END $$;

REVOKE ALL ON FUNCTION sutra.t03_reset_auto_cursor() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION sutra.schedule_auto_video_jobs(uuid,timestamptz,timestamptz,timestamptz,jsonb,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sutra.schedule_auto_video_jobs(uuid,timestamptz,timestamptz,timestamptz,jsonb,int) TO service_role;
DO $$ DECLARE object_id regprocedure; BEGIN
  FOREACH object_id IN ARRAY ARRAY['sutra.t03_reset_auto_cursor()'::regprocedure,
    'sutra.schedule_auto_video_jobs(uuid,timestamptz,timestamptz,timestamptz,jsonb,int)'::regprocedure] LOOP
    EXECUTE format('COMMENT ON FUNCTION %s IS %L',object_id,'T03_AUTO_SCHEDULER_V1:' || md5(pg_get_functiondef(object_id)));
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
