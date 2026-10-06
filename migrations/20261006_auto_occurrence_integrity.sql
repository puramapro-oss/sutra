-- Keep autonomous scheduling idempotent under concurrent cron invocations.
-- Existing rows are preserved; duplicate historical rows must be reviewed separately.
ALTER TABLE sutra.sutra_auto_videos
  DROP CONSTRAINT IF EXISTS sutra_auto_videos_status_check;

ALTER TABLE sutra.sutra_auto_videos
  ADD CONSTRAINT sutra_auto_videos_status_check CHECK (status IN (
    'planning','generating_script','generating_video','generating_audio',
    'compositing','ready','pending_approval','publishing','published',
    'partially_published','failed'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_auto_video_schedule_occurrence
  ON sutra.sutra_auto_videos(user_id, schedule_id, scheduled_for)
  WHERE schedule_id IS NOT NULL AND scheduled_for IS NOT NULL;
