-- =============================================================================
-- v10 — File de tâches durable + réservation de quota ATOMIQUE
-- Audit SUTRA #8/#9/#10/#14 :
--   * video_jobs : persistance des générations, claim atomique par bail
--     (FOR UPDATE SKIP LOCKED), reprise sans double génération (checkpoint
--     par scène + provider_job_ids + idempotency_key UNIQUE).
--   * video_quota_counters + reserve_video_quota() : réservation atomique en
--     UNE instruction SQL (plus de lecture-puis-action concurrence).
--   * release_video_quota() / complete_video_quota() : libération contrôlée.
--
-- NB : user_id est un uuid nu (pas de FK vers auth.users) pour rester
-- applicable/testable sur une base isolée ; l'application garantit la
-- provenance (auth.getUser() côté routes).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Compteurs de quota mensuels (réservation + settlement)
-- -----------------------------------------------------------------------------
create table if not exists video_quota_counters (
  user_id       uuid        not null,
  period_start  date        not null,
  reserved      int         not null default 0,
  completed     int         not null default 0,
  failed        int         not null default 0,
  released      int         not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, period_start)
);

comment on table video_quota_counters is 'Réservation atomique du quota vidéo mensuel : reserved = en cours, completed/failed/released = settlement';

-- -----------------------------------------------------------------------------
-- 2. Réservation atomique : UNE instruction, aucune fenêtre de course.
--    Retourne true si la place est réservée, false si le plan est épuisé.
--    p_limit <= 0 (illimité/admin) réserve sans compter.
-- -----------------------------------------------------------------------------
create or replace function reserve_video_quota(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
as $$
declare
  v_period date := date_trunc('month', now())::date;
  v_ok boolean;
begin
  if p_limit is null or p_limit <= 0 then
    -- illimité (admin) : on trace quand même une ligne
    insert into video_quota_counters (user_id, period_start, reserved)
    values (p_user_id, v_period, 1)
    on conflict (user_id, period_start)
    do update set reserved = video_quota_counters.reserved + 1, updated_at = now();
    return true;
  end if;

  insert into video_quota_counters (user_id, period_start, reserved)
  values (p_user_id, v_period, 1)
  on conflict (user_id, period_start)
  do update set reserved = video_quota_counters.reserved + 1
  where video_quota_counters.reserved + video_quota_counters.completed < p_limit
  returning true into v_ok;

  return coalesce(v_ok, false);
end;
$$;

-- Settlement : la génération a abouti (la place devient définitivement consommée).
create or replace function complete_video_quota(p_user_id uuid)
returns void
language sql
as $$
  update video_quota_counters
     set reserved = reserved - 1,
         completed = completed + 1,
         updated_at = now()
   where user_id = p_user_id
     and period_start = date_trunc('month', now())::date
     and reserved > 0;
$$;

-- Settlement : échec → la place est LIBÉRÉE (jamais facturée à l'utilisateur).
create or replace function release_video_quota(p_user_id uuid)
returns void
language sql
as $$
  update video_quota_counters
     set reserved = reserved - 1,
         released = released + 1,
         updated_at = now()
   where user_id = p_user_id
     and period_start = date_trunc('month', now())::date
     and reserved > 0;
$$;

-- -----------------------------------------------------------------------------
-- 3. File de tâches durable
-- -----------------------------------------------------------------------------
create table if not exists video_jobs (
  id                uuid        primary key default gen_random_uuid(),
  video_id          uuid,               -- videos.id (nullable : exports etc.)
  user_id           uuid        not null,
  kind              text        not null check (kind in ('create', 'production', 'auto', 'export')),
  payload           jsonb       not null default '{}',
  -- checkpoint de reprise : résultats déjà obtenus (par scène) pour ne JAMAIS
  -- régénérer ce qui est fait (audit #10/#14).
  progress          jsonb       not null default '{}',
  provider_job_ids  jsonb       not null default '{}',
  status            text        not null default 'queued'
                    check (status in ('queued', 'processing', 'done', 'failed', 'cancelled')),
  attempts          int         not null default 0,
  max_attempts      int         not null default 3,
  locked_by         text,
  locked_at         timestamptz,
  lease_until       timestamptz,
  last_error        text,
  idempotency_key   text        unique not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists video_jobs_status_ready
  on video_jobs (status, created_at)
  where status in ('queued', 'processing');

create index if not exists video_jobs_user
  on video_jobs (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 4. Claim atomique d'un lot de tâches (worker). FOR UPDATE SKIP LOCKED :
--    deux workers concurrents ne prennent JAMAIS la même tâche. Une tâche
--    « processing » dont le bail a expiré (worker mort) est reprise.
-- -----------------------------------------------------------------------------
create or replace function claim_video_jobs(p_worker text, p_limit int, p_lease_seconds int)
returns setof video_jobs
language plpgsql
as $$
declare
  v_row record;
  v_job video_jobs;
begin
  for v_row in
    select id from video_jobs
     where status = 'queued'
        or (status = 'processing' and lease_until < now())
     order by created_at
     limit greatest(1, coalesce(p_limit, 1))
     for update skip locked
  loop
    update video_jobs
       set status = 'processing',
           attempts = attempts + 1,
           locked_by = p_worker,
           locked_at = now(),
           lease_until = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 600))),
           updated_at = now()
     where id = v_row.id
     returning * into v_job;
    return next v_job;
  end loop;
  return;
end;
$$;

-- Claim ciblé par clé d'idempotence (exécution inline côté route : la route
-- ne doit jamais voler la tâche d'un autre). UNE instruction atomique.
-- setof : 0 ligne quand le claim est refusé (jamais de ligne de NULLs).
create or replace function claim_video_job_by_key(p_key text, p_worker text, p_lease_seconds int)
returns setof video_jobs
language plpgsql
as $$
declare
  v_job video_jobs;
begin
  update video_jobs
     set status = 'processing',
         attempts = attempts + 1,
         locked_by = p_worker,
         locked_at = now(),
         lease_until = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 600))),
         updated_at = now()
   where idempotency_key = p_key
     and (status = 'queued' or (status = 'processing' and lease_until < now()))
     and attempts < max_attempts
  returning * into v_job;
  if v_job.id is not null then
    return next v_job;
  end if;
  return;
end;
$$;

-- Renouvellement du bail (heartbeat d'un worker vivant sur une tâche longue).
create or replace function heartbeat_video_job(p_job_id uuid, p_worker text, p_lease_seconds int)
returns void
language sql
as $$
  update video_jobs
     set lease_until = now() + make_interval(secs => greatest(30, coalesce(p_lease_seconds, 600))),
         updated_at = now()
   where id = p_job_id
     and locked_by = p_worker
     and status = 'processing';
$$;

-- Checkpoint de progression (reprise sans double génération).
create or replace function checkpoint_video_job(p_job_id uuid, p_worker text, p_progress jsonb, p_provider_job_ids jsonb)
returns void
language sql
as $$
  update video_jobs
     set progress = coalesce(p_progress, progress),
         provider_job_ids = coalesce(p_provider_job_ids, provider_job_ids),
         updated_at = now()
   where id = p_job_id
     and locked_by = p_worker
     and status = 'processing';
$$;

-- =============================================================================
-- RLS : seul le service role (serveur) touche à ces tables.
-- Sur une base de test locale (sans rôle service_role), les policies sont
-- omises avec un NOTICE — le reste de la migration s'applique intégralement.
-- =============================================================================
alter table video_quota_counters enable row level security;
alter table video_jobs enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'drop policy if exists "service role only on video_quota_counters" on video_quota_counters';
    execute 'create policy "service role only on video_quota_counters" on video_quota_counters for all to service_role using (true) with check (true)';
    execute 'drop policy if exists "service role only on video_jobs" on video_jobs';
    execute 'create policy "service role only on video_jobs" on video_jobs for all to service_role using (true) with check (true)';
  else
    raise notice 'rôle service_role absent (base de test) — policies RLS omises';
  end if;
end;
$$;
