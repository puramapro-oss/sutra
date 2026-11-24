BEGIN;

-- Preserve the existing journal, unique intent identity and historical rows.
-- NULL sent_at records an intent whose provider outcome is not confirmed.
DO $$
BEGIN
  IF to_regclass('sutra.email_sequences') IS NULL THEN
    RAISE EXCEPTION 'Apply the existing SUTRA email_sequences schema before this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'sutra.email_sequences'::regclass
      AND attname = 'sent_at' AND attnotnull AND NOT attisdropped) THEN
    RAISE EXCEPTION 'email_sequences.sent_at must accept unresolved NULL reservations';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = 'sutra.email_sequences'::regclass AND i.indisunique AND i.indisvalid
      AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnkeyatts = 2
      AND ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, position)
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
        WHERE k.position <= i.indnkeyatts ORDER BY a.attname) = ARRAY['email_type', 'user_id']
  ) THEN
    RAISE EXCEPTION 'email_sequences requires its unique user_id,email_type admission constraint';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'sutra.email_sequences'::regclass
      AND attname = 'provider_message_id' AND NOT attisdropped
      AND (atttypid <> 'text'::regtype OR attnotnull)) THEN
    RAISE EXCEPTION 'email_sequences.provider_message_id is incompatible';
  END IF;
END $$;

ALTER TABLE sutra.email_sequences ADD COLUMN IF NOT EXISTS provider_message_id TEXT;
COMMENT ON COLUMN sutra.email_sequences.provider_message_id IS
  'Provider acceptance receipt; historical records may be NULL. Acceptance is not proof of delivery.';
COMMENT ON COLUMN sutra.email_sequences.sent_at IS
  'Provider acceptance time. NULL is an unresolved reserved intent and must never authorize automatic resending.';

CREATE INDEX IF NOT EXISTS email_sequences_unresolved_type_idx
  ON sutra.email_sequences(email_type) WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS email_sequence_candidate_window_idx
  ON sutra.profiles(created_at, id)
  WHERE access_revoked_at IS NULL AND subscription_status IS DISTINCT FROM 'banned';

-- Read-only candidate admission support. Existing receipts and unresolved
-- intents never consume a recipient page or re-enter the provider transport.
-- The established one-day UTC window is retained; this is not a catch-up campaign.
CREATE OR REPLACE FUNCTION sutra.email_sequence_candidates(
  p_email_type text, p_start timestamptz, p_end timestamptz,
  p_after uuid DEFAULT NULL, p_limit integer DEFAULT 100
) RETURNS TABLE (
  id uuid, email text, name text, email_preferences jsonb,
  subscription_status text, access_revoked_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE preference text;
BEGIN
  preference := CASE
    WHEN p_email_type = 'welcome' THEN 'welcome'
    WHEN p_email_type IN ('tip_day1', 'tips_day7', 'upgrade_day14', 'testimonial_day21') THEN 'tips'
    WHEN p_email_type IN ('reminder_day3', 'winback_day30') THEN 'inactivity'
    ELSE NULL
  END;
  IF preference IS NULL OR p_start IS NULL OR p_end IS NULL
    OR NOT isfinite(p_start) OR NOT isfinite(p_end)
    OR p_end - p_start <> interval '24 hours'
    OR p_start AT TIME ZONE 'UTC' <> date_trunc('day', p_start AT TIME ZONE 'UTC')
    OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'SUTRA_EMAIL_SEQUENCE_WINDOW_INVALID';
  END IF;
  RETURN QUERY
    SELECT p.id, p.email, p.name, p.email_preferences, p.subscription_status, p.access_revoked_at
    FROM sutra.profiles p
    WHERE p.created_at >= p_start AND p.created_at < p_end
      AND (p_after IS NULL OR p.id > p_after)
      AND p.access_revoked_at IS NULL AND p.subscription_status IS DISTINCT FROM 'banned'
      AND jsonb_typeof(p.email_preferences) = 'object'
      AND p.email_preferences -> preference = 'true'::jsonb
      AND char_length(p.email) <= 320
      AND p.email ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+[.][^[:space:]@<>]+$'
      AND NOT EXISTS (
        SELECT 1 FROM sutra.email_sequences receipt
        WHERE receipt.user_id = p.id AND receipt.email_type = p_email_type
      )
    ORDER BY p.id LIMIT p_limit;
END $$;

REVOKE ALL ON FUNCTION sutra.email_sequence_candidates(text,timestamptz,timestamptz,uuid,integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sutra.email_sequence_candidates(text,timestamptz,timestamptz,uuid,integer)
  TO service_role;
COMMENT ON FUNCTION sutra.email_sequence_candidates(text,timestamptz,timestamptz,uuid,integer) IS
  'Read-only eligible recipients without any existing sequence intent. Service role only; daily UTC windows unchanged.';

NOTIFY pgrst, 'reload schema';
COMMIT;
