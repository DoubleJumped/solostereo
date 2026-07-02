-- 006: materialize the summary views into real tables (perf).
--
-- The summary views (002/003) recompute their aggregates over the full
-- 208k-row history on every read — ~0.1-1.1s of synchronous CPU per page
-- load (better-sqlite3 blocks the event loop while it runs). But the data
-- only changes on import/sync, so the aggregates are precomputed instead:
--
--   * each former view V is renamed to V_src (same SQL, still the single
--     source of truth for the aggregation logic), and
--   * a real table named V is created from it, so every existing query
--     reads the table with no SQL changes.
--
-- lib/summaries.ts refreshes the tables (DELETE + INSERT ... SELECT from the
-- _src views, one transaction) after every write: scripts/import.ts and the
-- Spotify sync (lib/spotify.ts). The demo build inherits these tables via its
-- snapshot copy, replacing its own materialization step.
--
-- overview_alltime is new: the one-row all-time headline stats (the three
-- COUNT(DISTINCT ...) over 208k rows were ~200ms live). It mirrors the
-- former demo_overview_alltime and getOverviewStats() exactly, camelCase
-- column aliases included.

DROP VIEW artist_summary;
DROP VIEW album_summary;
DROP VIEW track_summary;
DROP VIEW artist_year_summary;
DROP VIEW album_year_summary;
DROP VIEW track_year_summary;
DROP VIEW monthly_listening_summary;
DROP VIEW yearly_listening_summary;

-- ---- source views: bodies identical to 002/003 ----------------------------

CREATE VIEW artist_summary_src AS
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

CREATE VIEW album_summary_src AS
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

CREATE VIEW track_summary_src AS
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

CREATE VIEW artist_year_summary_src AS
SELECT
  CAST(strftime('%Y', played_at) AS INTEGER)  AS year,
  artist_name,
  COUNT(*)                                    AS raw_plays,
  SUM(ms_played >= 30000)                     AS meaningful_plays,
  SUM(ms_played)                              AS total_ms_played,
  SUM(ms_played) / 60000.0                    AS listening_minutes
FROM music_listening_events
WHERE artist_name IS NOT NULL
GROUP BY year, artist_name;

CREATE VIEW album_year_summary_src AS
SELECT
  CAST(strftime('%Y', played_at) AS INTEGER)  AS year,
  artist_name,
  album_name,
  COUNT(*)                                    AS raw_plays,
  SUM(ms_played >= 30000)                     AS meaningful_plays,
  SUM(ms_played)                              AS total_ms_played,
  SUM(ms_played) / 60000.0                    AS listening_minutes
FROM music_listening_events
WHERE artist_name IS NOT NULL AND album_name IS NOT NULL
GROUP BY year, artist_name, album_name;

CREATE VIEW track_year_summary_src AS
SELECT
  CAST(strftime('%Y', played_at) AS INTEGER)  AS year,
  artist_name,
  track_name,
  MAX(album_name)                             AS album_name,
  COUNT(*)                                    AS raw_plays,
  SUM(ms_played >= 30000)                     AS meaningful_plays,
  SUM(ms_played)                              AS total_ms_played,
  SUM(ms_played) / 60000.0                    AS listening_minutes
FROM music_listening_events
WHERE artist_name IS NOT NULL AND track_name IS NOT NULL
GROUP BY year, artist_name, track_name;

CREATE VIEW monthly_listening_summary_src AS
SELECT
  strftime('%Y-%m', played_at)                AS month,
  CAST(strftime('%Y', played_at) AS INTEGER)  AS year,
  COUNT(*)                                    AS raw_events,
  SUM(ms_played)                              AS total_ms_played,
  SUM(ms_played) / 60000.0                    AS listening_minutes,
  SUM(CASE WHEN spotify_episode_uri IS NULL AND episode_name IS NULL
            AND audiobook_uri IS NULL AND audiobook_chapter_uri IS NULL
            AND audiobook_title IS NULL
           THEN ms_played ELSE 0 END)         AS music_ms_played,
  SUM(CASE WHEN spotify_episode_uri IS NULL AND episode_name IS NULL
            AND audiobook_uri IS NULL AND audiobook_chapter_uri IS NULL
            AND audiobook_title IS NULL
            AND ms_played >= 30000
           THEN 1 ELSE 0 END)                 AS meaningful_plays
FROM listening_events
GROUP BY month;

CREATE VIEW yearly_listening_summary_src AS
SELECT
  CAST(strftime('%Y', played_at) AS INTEGER)  AS year,
  COUNT(*)                                    AS raw_events,
  SUM(ms_played)                              AS total_ms_played,
  SUM(ms_played) / 60000.0                    AS listening_minutes,
  SUM(CASE WHEN spotify_episode_uri IS NULL AND episode_name IS NULL
            AND audiobook_uri IS NULL AND audiobook_chapter_uri IS NULL
            AND audiobook_title IS NULL
           THEN ms_played ELSE 0 END)         AS music_ms_played,
  SUM(CASE WHEN spotify_episode_uri IS NULL AND episode_name IS NULL
            AND audiobook_uri IS NULL AND audiobook_chapter_uri IS NULL
            AND audiobook_title IS NULL
            AND ms_played >= 30000
           THEN 1 ELSE 0 END)                 AS meaningful_plays
FROM listening_events
GROUP BY year;

CREATE VIEW overview_alltime_src AS
SELECT
  SUM(ms_played >= 30000)                            AS meaningfulPlays,
  COUNT(*)                                           AS rawPlays,
  SUM(ms_played) / 3600000.0                         AS listeningHours,
  COUNT(DISTINCT artist_name)                        AS uniqueArtists,
  COUNT(DISTINCT artist_name || '|' || album_name)   AS uniqueAlbums,
  COUNT(DISTINCT artist_name || '|' || track_name)   AS uniqueTracks,
  MIN(played_at)                                     AS firstEvent,
  MAX(played_at)                                     AS lastEvent
FROM music_listening_events;

-- ---- materialized tables (initial fill) -----------------------------------

CREATE TABLE artist_summary             AS SELECT * FROM artist_summary_src;
CREATE TABLE album_summary              AS SELECT * FROM album_summary_src;
CREATE TABLE track_summary              AS SELECT * FROM track_summary_src;
CREATE TABLE artist_year_summary        AS SELECT * FROM artist_year_summary_src;
CREATE TABLE album_year_summary         AS SELECT * FROM album_year_summary_src;
CREATE TABLE track_year_summary         AS SELECT * FROM track_year_summary_src;
CREATE TABLE monthly_listening_summary  AS SELECT * FROM monthly_listening_summary_src;
CREATE TABLE yearly_listening_summary   AS SELECT * FROM yearly_listening_summary_src;
CREATE TABLE overview_alltime           AS SELECT * FROM overview_alltime_src;

-- Indexes for the lookups/filters the app does against these tables
-- (same set the demo build used to create).
CREATE INDEX idx_artist_summary_name ON artist_summary(artist_name);
CREATE INDEX idx_album_summary_name  ON album_summary(artist_name);
CREATE INDEX idx_track_summary_name  ON track_summary(artist_name);
CREATE INDEX idx_ays_year  ON artist_year_summary(year);
CREATE INDEX idx_ays_name  ON artist_year_summary(artist_name);
CREATE INDEX idx_alys_year ON album_year_summary(year);
CREATE INDEX idx_tys_year  ON track_year_summary(year);
