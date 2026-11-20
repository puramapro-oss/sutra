-- PREPARATION ONLY. Apply explicitly to an EXTERNAL PostgreSQL instance after approval.
-- No connection, login, activation, GPU resource or existing application table changed.
-- One journal, not a second queue. No scheduler or retry execution is introduced.
BEGIN;
CREATE SCHEMA IF NOT EXISTS salad_worker;
REVOKE ALL ON SCHEMA salad_worker FROM PUBLIC;
CREATE TABLE IF NOT EXISTS salad_worker.jobs (
 id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),
 record jsonb NOT NULL CHECK(record->>'id'=id),
 CHECK (record->>'status' IN ('running','unknown','succeeded'))
);
CREATE UNIQUE INDEX IF NOT EXISTS one_exclusive_engine ON salad_worker.jobs ((1))
 WHERE record->>'status' IN ('running','unknown');
CREATE TABLE IF NOT EXISTS salad_worker.artifacts (
 id text PRIMARY KEY REFERENCES salad_worker.jobs(id),
 bytes bytea NOT NULL CHECK(octet_length(bytes)>0 AND octet_length(bytes)<=67108864),
 digest text NOT NULL CHECK(digest=encode(sha256(bytes),'hex'))
);
REVOKE ALL ON ALL TABLES IN SCHEMA salad_worker FROM PUBLIC;
ALTER TABLE salad_worker.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE salad_worker.artifacts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION salad_worker.load_job(p_id text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,salad_worker AS $$
 -- NULL is the authenticated worker's read-only global-slot inspection.
 SELECT record FROM salad_worker.jobs WHERE id=p_id
 OR (p_id IS NULL AND record->>'status' IN ('running','unknown'))
$$;
CREATE OR REPLACE FUNCTION salad_worker.reserve_job(p_job jsonb) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,salad_worker AS $$
DECLARE old jsonb;
BEGIN
 IF p_job IS NULL OR p_job->>'id' IS NULL OR p_job->>'id' !~ '^[a-f0-9]{64}$'
 OR p_job->>'scope' IS NULL OR p_job->>'scope' !~ '^[a-f0-9]{64}$'
 OR p_job->>'fingerprint' IS NULL OR p_job->>'fingerprint' !~ '^[a-f0-9]{64}$'
 OR p_job->>'protocol' IS DISTINCT FROM 'sutra-salad-worker/1'
 OR p_job->>'provider' IS DISTINCT FROM 'salad' OR p_job->>'revision' IS DISTINCT FROM '0'
 OR p_job->>'status' IS DISTINCT FROM 'running' OR p_job->'artifact' IS DISTINCT FROM 'null'::jsonb
 THEN RAISE EXCEPTION 'SALAD_INVALID_CHECKPOINT'; END IF;
 -- Serializes the global slot, including concurrent attempts with different job ids.
 PERFORM pg_advisory_xact_lock(1398101074,1);
 SELECT record INTO old FROM salad_worker.jobs WHERE id=p_job->>'id';
 IF old IS NOT NULL THEN
  IF old->>'scope' IS DISTINCT FROM p_job->>'scope' OR old->>'fingerprint' IS DISTINCT FROM p_job->>'fingerprint'
  THEN RAISE EXCEPTION 'SALAD_IDEMPOTENCY_CONFLICT'; END IF;
  RETURN 'existing';
 END IF;
 IF EXISTS(SELECT 1 FROM salad_worker.jobs WHERE record->>'status' IN ('running','unknown')) THEN RETURN 'busy'; END IF;
 INSERT INTO salad_worker.jobs VALUES(p_job->>'id',p_job);
 RETURN 'created';
END $$;
CREATE OR REPLACE FUNCTION salad_worker.compare_job(p_previous jsonb,p_next jsonb) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,salad_worker AS $$
DECLARE old jsonb;
BEGIN
 SELECT record INTO old FROM salad_worker.jobs WHERE id=p_previous->>'id' FOR UPDATE;
 IF old IS NULL OR old IS DISTINCT FROM p_previous THEN RETURN false; END IF;
 -- Full-record compare fences stale owners, not just a client-supplied revision.
 IF old->>'status' NOT IN ('running','unknown') OR p_next IS NULL
 OR (p_next - ARRAY['revision','status','artifact']) IS DISTINCT FROM (old - ARRAY['revision','status','artifact'])
 OR (p_next->>'revision')::bigint IS DISTINCT FROM (old->>'revision')::bigint+1
 OR p_next->>'status' IS NULL OR p_next->>'status' NOT IN ('unknown','succeeded')
 THEN RAISE EXCEPTION 'SALAD_INVALID_TRANSITION'; END IF;
 IF p_next->>'status'='succeeded' THEN
  IF NOT EXISTS(SELECT 1 FROM salad_worker.artifacts a WHERE a.id=old->>'id'
   AND p_next->'artifact'->>'key'=a.id AND p_next->'artifact'->>'sha256'=a.digest
   AND (p_next->'artifact'->>'bytes')::bigint=octet_length(a.bytes))
  THEN RAISE EXCEPTION 'SALAD_DURABLE_ARTIFACT_REQUIRED'; END IF;
 ELSIF p_next->'artifact' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'SALAD_INVALID_ARTIFACT'; END IF;
 UPDATE salad_worker.jobs SET record=p_next WHERE id=old->>'id';
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION salad_worker.put_artifact(p_id text,p_bytes bytea,p_digest text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,salad_worker AS $$
DECLARE old salad_worker.artifacts;
BEGIN
 IF p_bytes IS NULL OR octet_length(p_bytes)=0 OR octet_length(p_bytes)>67108864
 OR p_digest IS DISTINCT FROM encode(sha256(p_bytes),'hex')
 THEN RAISE EXCEPTION 'SALAD_INVALID_ARTIFACT'; END IF;
 PERFORM 1 FROM salad_worker.jobs WHERE id=p_id AND record->>'status' IN ('running','unknown','succeeded') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SALAD_JOB_NOT_FOUND'; END IF;
 INSERT INTO salad_worker.artifacts VALUES(p_id,p_bytes,p_digest) ON CONFLICT(id) DO NOTHING;
 SELECT * INTO old FROM salad_worker.artifacts WHERE id=p_id;
 IF old.bytes IS DISTINCT FROM p_bytes OR old.digest IS DISTINCT FROM p_digest THEN RAISE EXCEPTION 'SALAD_ARTIFACT_CONFLICT'; END IF;
 RETURN true;
END $$;
CREATE OR REPLACE FUNCTION salad_worker.get_artifact(p_id text) RETURNS bytea
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,salad_worker AS $$
 SELECT bytes FROM salad_worker.artifacts WHERE id=p_id
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA salad_worker FROM PUBLIC;
-- An operator separately creates a dedicated restricted LOGIN, without application credentials.
-- No password or role is created by this preparation. Grant only if explicitly provisioned.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='sutra_salad_worker') THEN
  GRANT USAGE ON SCHEMA salad_worker TO sutra_salad_worker;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA salad_worker TO sutra_salad_worker;
 END IF;
END $$;
COMMIT;
