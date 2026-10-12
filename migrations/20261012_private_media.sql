-- Legacy object authority is populated by the reviewed cutover inventory.
-- Do not switch the Storage bucket here: that belongs to the final cutover
-- after the compatible application and legacy reference migration are ready.
CREATE TABLE IF NOT EXISTS sutra.media_ownership (
  object_path text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(object_path) BETWEEN 1 AND 1024)
);
ALTER TABLE sutra.media_ownership ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sutra.media_ownership FROM PUBLIC, anon, authenticated;
GRANT ALL ON sutra.media_ownership TO service_role;
