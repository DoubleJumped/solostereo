-- 001: raw listening events table (plan.md §7)
-- One row per streaming event from the Spotify Extended Streaming History
-- export. Raw history stays separate from derived analytics (views come in
-- later migrations).

CREATE TABLE listening_events (
  event_id            INTEGER PRIMARY KEY,
  dedup_hash          TEXT NOT NULL UNIQUE,
  played_at           TEXT NOT NULL,        -- UTC ISO 8601
  source_filename     TEXT NOT NULL,
  platform            TEXT,
  country_code        TEXT,
  track_name          TEXT,
  artist_name         TEXT,
  album_name          TEXT,
  spotify_track_uri   TEXT,
  episode_name        TEXT,
  episode_show_name   TEXT,
  spotify_episode_uri TEXT,
  audiobook_title     TEXT,
  audiobook_uri       TEXT,
  audiobook_chapter_uri   TEXT,
  audiobook_chapter_title TEXT,
  ms_played           INTEGER NOT NULL,
  reason_start        TEXT,
  reason_end          TEXT,
  shuffle             INTEGER,              -- boolean
  skipped             INTEGER,              -- boolean
  offline             INTEGER,              -- boolean
  offline_timestamp   TEXT,
  incognito_mode      INTEGER,              -- boolean
  imported_at         TEXT NOT NULL
);

-- These indexes are the performance strategy (plan.md §7).
-- Note: the UNIQUE constraint on dedup_hash already creates an implicit
-- unique index; idx_events_dedup is kept as the explicit named form.
CREATE UNIQUE INDEX idx_events_dedup ON listening_events(dedup_hash);
CREATE INDEX idx_events_played_at   ON listening_events(played_at);
CREATE INDEX idx_events_artist_time ON listening_events(artist_name, played_at);
CREATE INDEX idx_events_track_uri   ON listening_events(spotify_track_uri);
