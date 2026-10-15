CREATE OR REPLACE FUNCTION sutra.cancel_video_job(p_key text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'sutra', 'pg_temp'
AS $function$
DECLARE j video_jobs;
BEGIN
 SELECT * INTO j FROM video_jobs WHERE idempotency_key=p_key AND status IN ('queued','processing','reconciliation_required') FOR UPDATE;
 IF j.id IS NULL THEN RETURN false; END IF;
 UPDATE video_quota_counters SET reserved=reserved-1,released=released+1,updated_at=clock_timestamp()
  WHERE user_id=j.user_id AND period_start=date_trunc('month',j.created_at)::date AND reserved>0;
 IF NOT FOUND THEN RAISE EXCEPTION 'SUTRA_QUOTA_RECONCILIATION_REQUIRED'; END IF;
 UPDATE video_jobs SET status='cancelled',locked_by=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=j.id;
 RETURN true;
END $function$
