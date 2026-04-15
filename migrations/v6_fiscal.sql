-- V6 Section 17 — Notification fiscale auto
SET search_path TO sutra, public;

CREATE TABLE IF NOT EXISTS sutra.fiscal_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  palier INT NOT NULL CHECK (palier IN (1, 2, 3, 4)),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  push_sent BOOLEAN NOT NULL DEFAULT FALSE,
  acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(user_id, palier)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_notif_user ON sutra.fiscal_notifications(user_id);
ALTER TABLE sutra.fiscal_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fiscal_own_read" ON sutra.fiscal_notifications;
CREATE POLICY "fiscal_own_read" ON sutra.fiscal_notifications
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fiscal_own_update" ON sutra.fiscal_notifications;
CREATE POLICY "fiscal_own_update" ON sutra.fiscal_notifications
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS sutra.annual_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES sutra.profiles(id) ON DELETE CASCADE,
  year INT NOT NULL,
  total_primes DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_parrainage DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_nature DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_marketplace DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_missions DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total_annuel DECIMAL(10, 2) NOT NULL DEFAULT 0,
  pdf_url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, year)
);

CREATE INDEX IF NOT EXISTS idx_annual_user ON sutra.annual_summaries(user_id);
ALTER TABLE sutra.annual_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "annual_own_read" ON sutra.annual_summaries;
CREATE POLICY "annual_own_read" ON sutra.annual_summaries
  FOR SELECT USING (auth.uid() = user_id);
