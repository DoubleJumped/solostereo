-- 005: playlist storage — generated/hand-built playlists and their tracks
-- (plan.md Phase 8 (playlists)). A playlist is a draft until pushed to
-- Spotify; tracks keep their recipe provenance (reason/score) and can be
-- excluded without deleting.

CREATE TABLE playlists (
  id                  INTEGER PRIMARY KEY,
  name                TEXT NOT NULL,
  description         TEXT,
  recipe_key          TEXT,                 -- which recipe generated it (NULL if hand-built)
  params_json         TEXT,                 -- JSON of the recipe params used
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pushed')),
  public              INTEGER NOT NULL DEFAULT 1,   -- boolean; public-by-default on push
  spotify_playlist_id TEXT,
  spotify_snapshot_id TEXT,
  created_at          TEXT NOT NULL,        -- ISO 8601
  updated_at          TEXT NOT NULL,        -- ISO 8601
  pushed_at           TEXT                  -- ISO 8601, null until pushed
);

CREATE TABLE playlist_tracks (
  id                INTEGER PRIMARY KEY,
  playlist_id       INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  position          INTEGER NOT NULL,       -- 0-based order within the playlist
  spotify_track_uri TEXT NOT NULL,
  artist_name       TEXT,
  track_name        TEXT,
  album_name        TEXT,
  reason            TEXT,                   -- human-readable why-picked, e.g. "14 plays in Jul 2019"
  score             REAL,                   -- recipe score
  included          INTEGER NOT NULL DEFAULT 1,   -- boolean; exclude-without-deleting
  added_manually    INTEGER NOT NULL DEFAULT 0,   -- boolean
  UNIQUE (playlist_id, spotify_track_uri)
);

-- Ordered reads of a playlist's tracks (plan.md Phase 8).
CREATE INDEX idx_playlist_tracks_order ON playlist_tracks(playlist_id, position);
