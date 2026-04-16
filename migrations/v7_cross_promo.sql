-- V7 SUPREME — Cross-Promo tracking (section 15 CLAUDE.md)
-- Table: tracking des clics /go/[source]?coupon=WELCOME50 et conversions
SET search_path TO sutra, public;

CREATE TABLE IF NOT EXISTS sutra.cross_promos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app TEXT NOT NULL,
  target_app TEXT NOT NULL DEFAULT 'sutra',
  user_id UUID REFERENCES sutra.profiles(id) ON DELETE SET NULL,
  anon_id TEXT,
  coupon_code TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  user_agent TEXT,
  referrer TEXT
);

CREATE INDEX IF NOT EXISTS idx_cross_promos_user ON sutra.cross_promos(user_id);
CREATE INDEX IF NOT EXISTS idx_cross_promos_source ON sutra.cross_promos(source_app, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_cross_promos_anon ON sutra.cross_promos(anon_id) WHERE anon_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cross_promos_converted ON sutra.cross_promos(converted, clicked_at DESC);

ALTER TABLE sutra.cross_promos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cross_promos_own_read" ON sutra.cross_promos;
CREATE POLICY "cross_promos_own_read" ON sutra.cross_promos
  FOR SELECT USING (auth.uid() = user_id OR auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "cross_promos_service_insert" ON sutra.cross_promos;
CREATE POLICY "cross_promos_service_insert" ON sutra.cross_promos
  FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role');

DROP POLICY IF EXISTS "cross_promos_service_update" ON sutra.cross_promos;
CREATE POLICY "cross_promos_service_update" ON sutra.cross_promos
  FOR UPDATE USING (auth.jwt()->>'role' = 'service_role');

COMMENT ON TABLE sutra.cross_promos IS 'V7 Cross-promo tracking — source_app=app qui envoie le trafic via /go/[source]?coupon=WELCOME50, target_app=app courante';
