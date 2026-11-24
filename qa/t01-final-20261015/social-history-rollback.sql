-- Explicit migration-owner rollback only. Retains every fact, read policy and ACL.
-- Capture is stopped: history completeness must be reported as suspended until
-- the forward migration is restored. Never use this as a silent green bypass.
BEGIN;
DROP TRIGGER IF EXISTS sutra_capture_social_authorization_history ON public.social_accounts;
DROP FUNCTION IF EXISTS sutra.capture_social_authorization_history();
COMMIT;
