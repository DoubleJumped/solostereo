-- 004: Spotify account + OAuth tokens for the live "recently played" sync
-- (Phase 7). Single-row table (id = 1) — this is a single-user local app.
-- Tokens live in the local, gitignored DB; never committed.
--
-- last_played_at is the sync cursor: the played_at of the newest event we have
-- pulled from the API, passed back as the `after` parameter on the next sync.

CREATE TABLE spotify_account (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  account_id       TEXT NOT NULL,        -- stable Spotify user id
  display_name     TEXT,
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  token_expires_at TEXT NOT NULL,        -- ISO 8601
  scope            TEXT,
  last_synced_at   TEXT,                 -- ISO 8601, last successful sync
  last_played_at   TEXT,                 -- ISO 8601, cursor (newest synced event)
  connected_at     TEXT NOT NULL
);
