-- Additive, no historical rows rewritten. Deploy before the matching scan route.
-- Quotas preserve the existing contract: one IP/partner and 100/partner/24h.
BEGIN;

CREATE INDEX IF NOT EXISTS idx_partner_scans_window
  ON sutra.partner_scans (partner_id, scanned_at);

CREATE OR REPLACE FUNCTION sutra.record_partner_scan(
  p_code text, p_ip_address text, p_device text, p_os text
) RETURNS text
LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_partner uuid;
  v_status text;
  v_now timestamptz;
  v_ip inet;
BEGIN
  -- A waiting transaction needs a fresh snapshot after acquiring the row lock.
  -- PostgREST uses READ COMMITTED. Other isolation levels fail closed.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'Unsupported scan transaction isolation' USING ERRCODE = '25001';
  END IF;
  IF p_code IS NULL OR length(p_code) < 3 OR length(p_code) > 200
     OR p_ip_address IS NULL OR length(p_ip_address) > 45
     OR p_device IS NULL OR length(p_device) > 32
     OR p_os IS NULL OR length(p_os) > 32 THEN
    RAISE EXCEPTION 'Invalid scan input' USING ERRCODE = '22023';
  END IF;
  v_ip := p_ip_address::inet;
  IF masklen(v_ip) <> (CASE family(v_ip) WHEN 4 THEN 32 ELSE 128 END) THEN
    RAISE EXCEPTION 'Invalid scan address' USING ERRCODE = '22023';
  END IF;

  SELECT id, status INTO v_partner, v_status
    FROM sutra.partners WHERE code = p_code FOR UPDATE;
  IF NOT FOUND OR v_status IS DISTINCT FROM 'active' THEN RETURN 'not_found'; END IF;
  v_now := clock_timestamp();

  IF EXISTS (SELECT 1 FROM sutra.partner_scans
    WHERE partner_id = v_partner AND ip_address = v_ip
      AND scanned_at >= v_now - interval '24 hours') THEN
    RETURN 'duplicate';
  END IF;
  IF (SELECT count(*) FROM sutra.partner_scans
      WHERE partner_id = v_partner AND scanned_at >= v_now - interval '24 hours') >= 100 THEN
    RETURN 'quota_exceeded';
  END IF;
  INSERT INTO sutra.partner_scans (partner_id, scanned_at, ip_address, device, os)
    VALUES (v_partner, v_now, v_ip, p_device, p_os);
  RETURN 'recorded';
END;
$$;

REVOKE ALL ON FUNCTION sutra.record_partner_scan(text,text,text,text) FROM PUBLIC, anon, authenticated;
-- SECURITY INVOKER must not depend on installation-specific default privileges.
GRANT USAGE ON SCHEMA sutra TO service_role;
GRANT SELECT, UPDATE ON sutra.partners TO service_role;
GRANT SELECT, INSERT ON sutra.partner_scans TO service_role;
GRANT EXECUTE ON FUNCTION sutra.record_partner_scan(text,text,text,text) TO service_role;
COMMENT ON FUNCTION sutra.record_partner_scan(text,text,text,text)
  IS 'Service-only atomic scan admission; existing rolling 24h quotas; no financial mutation';
NOTIFY pgrst, 'reload schema';
COMMIT;
