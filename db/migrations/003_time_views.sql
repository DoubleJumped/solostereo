-- 003: year/month-grain views (plan.md §7).
--
-- Date bucketing is UTC everywhere (plan.md §5.2) via strftime on the ISO
-- timestamps. Entity-by-year views cover music only; the monthly/yearly
-- listening summaries cover ALL events (music + podcast + audiobook) so
-- their totals reconcile to the full history (validation check 3), with a
-- music-only breakdown column for pages that want just music.

CREATE VIEW artist_year_summary AS
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

CREATE VIEW album_year_summary AS
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

CREATE VIEW track_year_summary AS
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

CREATE VIEW monthly_listening_summary AS
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

CREATE VIEW yearly_listening_summary AS
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
