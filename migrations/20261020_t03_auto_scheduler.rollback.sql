-- Stop scheduler first; restore previous application image, then run if needed.
-- Retain the cursor column AND reset trigger so edits during rollback cannot
-- later replay an obsolete calendar. No jobs, quotas, checkpoints or rows removed.
BEGIN;
DO $$ DECLARE object_id regprocedure := to_regprocedure('sutra.schedule_auto_video_jobs(uuid,timestamptz,timestamptz,timestamptz,jsonb,int)'); BEGIN
  IF object_id IS NOT NULL AND obj_description(object_id,'pg_proc') IS DISTINCT FROM
    'T03_AUTO_SCHEDULER_V1:' || md5(pg_get_functiondef(object_id)) THEN
    RAISE EXCEPTION 'SUTRA_SCHEDULER_DEFINITION_DRIFT';
  END IF;
END $$;
DROP FUNCTION IF EXISTS sutra.schedule_auto_video_jobs(uuid,timestamptz,timestamptz,timestamptz,jsonb,int);
NOTIFY pgrst, 'reload schema';
COMMIT;
