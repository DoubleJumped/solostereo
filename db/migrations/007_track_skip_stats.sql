-- 007: skip stats on track_summary (skips page + track detail pages).
--
-- `skipped` comes straight from the Spotify export. It is NULL when unknown —
-- rows synced from the Web API (source_filename='spotify-api'), which doesn't
-- report skips. Unknown rows count in neither `skips` nor `skip_known_plays`,
-- so skip rate = skips / skip_known_plays never guesses. COALESCE keeps
-- `skips` 0 (not NULL) for tracks whose every play is API-synced.
--
-- Rebuilds track_summary_src + its materialized table with the two new
-- columns (lib/summaries.ts refreshes by SELECT *, so no other change).
-- idx_tys_name is new: track detail pages look up track_year_summary by
-- artist, which previously had only the year index.

DROP VIEW track_summary_src;
DROP TABLE track_summary;

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
  MAX(played_at)                             AS last_played_at,
  COALESCE(SUM(skipped = 1), 0)              AS skips,
  SUM(skipped IS NOT NULL)                   AS skip_known_plays
FROM music_listening_events
WHERE artist_name IS NOT NULL AND track_name IS NOT NULL
GROUP BY artist_name, track_name;

CREATE TABLE track_summary AS SELECT * FROM track_summary_src;

CREATE INDEX idx_track_summary_name ON track_summary(artist_name);
CREATE INDEX idx_tys_name ON track_year_summary(artist_name);
