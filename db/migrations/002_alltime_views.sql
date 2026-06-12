-- 002: music view + all-time summary views (plan.md §7 derived views).
--
-- Category rules (must match lib/import-summary.ts predicates):
--   podcast   = spotify_episode_uri or episode_name present
--   audiobook = audiobook_uri / chapter uri / title present
--   music     = everything else
--
-- Metric rules (plan.md §8):
--   meaningful_play = music event with ms_played >= 30000 (default metric)
--   raw_play        = any music event (secondary)
--   listening time  = SUM(ms_played) over ALL events, incl. sub-30s
-- Summary views exclude rows with NULL artist_name (they stay in the raw
-- table and the music view, but cannot be ranked).

CREATE VIEW music_listening_events AS
SELECT *
FROM listening_events
WHERE NOT (spotify_episode_uri IS NOT NULL OR episode_name IS NOT NULL)
  AND NOT (audiobook_uri IS NOT NULL OR audiobook_chapter_uri IS NOT NULL
           OR audiobook_title IS NOT NULL);

CREATE VIEW artist_summary AS
SELECT
  artist_name,
  COUNT(*)                                   AS raw_plays,
  SUM(ms_played >= 30000)                    AS meaningful_plays,
  SUM(ms_played)                             AS total_ms_played,
  SUM(ms_played) / 60000.0                   AS listening_minutes,
  MIN(played_at)                             AS first_played_at,
  MAX(played_at)                             AS last_played_at,
  COUNT(DISTINCT track_name)                 AS distinct_tracks
FROM music_listening_events
WHERE artist_name IS NOT NULL
GROUP BY artist_name;

CREATE VIEW album_summary AS
SELECT
  artist_name,
  album_name,
  COUNT(*)                                   AS raw_plays,
  SUM(ms_played >= 30000)                    AS meaningful_plays,
  SUM(ms_played)                             AS total_ms_played,
  SUM(ms_played) / 60000.0                   AS listening_minutes,
  MIN(played_at)                             AS first_played_at,
  MAX(played_at)                             AS last_played_at,
  COUNT(DISTINCT track_name)                 AS distinct_tracks
FROM music_listening_events
WHERE artist_name IS NOT NULL AND album_name IS NOT NULL
GROUP BY artist_name, album_name;

CREATE VIEW track_summary AS
SELECT
  artist_name,
  track_name,
  MAX(album_name)                            AS album_name,
  COUNT(*)                                   AS raw_plays,
  SUM(ms_played >= 30000)                    AS meaningful_plays,
  SUM(ms_played)                             AS total_ms_played,
  SUM(ms_played) / 60000.0                   AS listening_minutes,
  MIN(played_at)                             AS first_played_at,
  MAX(played_at)                             AS last_played_at
FROM music_listening_events
WHERE artist_name IS NOT NULL AND track_name IS NOT NULL
GROUP BY artist_name, track_name;
