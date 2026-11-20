-- Restore the previous application image before removing its RPC dependency.
-- Keeps all scan records, partners, existing RLS and the harmless lookup index.
BEGIN;
DROP FUNCTION IF EXISTS sutra.record_partner_scan(text,text,text,text);
COMMIT;
