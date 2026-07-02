-- 008: count only early skips (supersedes 007's skips definition).
--
-- The export's `skipped` flag marks any forward-button press — including
-- jumping ahead when a track is nearly over, which isn't a rejection. A real
-- skip is bailing early: skipped AND ms_played < 30000. The 30s line is the
-- same boundary meaningful_plays already uses (plan.md §8), so every known
-- play is either a meaningful listen or cheap to classify as an early bail —
-- the two metrics can't disagree about the same play. (The export has no
-- track duration column, so a percent-of-track cutoff isn't possible.)
--
-- skip_known_plays is unchanged: the honest denominator is still every play
-- where the export recorded skip data at all.

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
  COALESCE(SUM(skipped = 1 AND ms_played < 30000), 0) AS skips,
  SUM(skipped IS NOT NULL)                   AS skip_known_plays
FROM music_listening_events
WHERE artist_name IS NOT NULL AND track_name IS NOT NULL
GROUP BY artist_name, track_name;

CREATE TABLE track_summary AS SELECT * FROM track_summary_src;

CREATE INDEX idx_track_summary_name ON track_summary(artist_name);
