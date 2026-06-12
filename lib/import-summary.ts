import type Database from "better-sqlite3";

/**
 * Row-category predicates (shared with views in Phase 2):
 * podcast = has episode uri/name; audiobook = has audiobook uri/chapter;
 * music = everything else.
 */
export const PODCAST_WHERE =
  "(spotify_episode_uri IS NOT NULL OR episode_name IS NOT NULL)";
export const AUDIOBOOK_WHERE =
  "(audiobook_uri IS NOT NULL OR audiobook_chapter_uri IS NOT NULL OR audiobook_title IS NOT NULL)";
export const MUSIC_WHERE = `NOT ${PODCAST_WHERE} AND NOT ${AUDIOBOOK_WHERE}`;

export interface DbSummary {
  totalRows: number;
  musicRows: number;
  podcastRows: number;
  audiobookRows: number;
  musicRowsMissingArtist: number;
  musicRowsMissingTrack: number;
  earliestEvent: string | null;
  latestEvent: string | null;
  totalListeningHours: number;
}

export function computeDbSummary(db: Database.Database): DbSummary {
  const one = <T>(sql: string) => db.prepare(sql).get() as T;

  const counts = one<{
    total: number;
    podcast: number;
    audiobook: number;
    music: number;
  }>(
    `SELECT COUNT(*) AS total,
            SUM(${PODCAST_WHERE}) AS podcast,
            SUM(${AUDIOBOOK_WHERE}) AS audiobook,
            SUM(${MUSIC_WHERE}) AS music
     FROM listening_events`,
  );

  const missing = one<{ noArtist: number; noTrack: number }>(
    `SELECT SUM(artist_name IS NULL) AS noArtist,
            SUM(track_name IS NULL) AS noTrack
     FROM listening_events
     WHERE ${MUSIC_WHERE}`,
  );

  const range = one<{ earliest: string | null; latest: string | null; ms: number | null }>(
    `SELECT MIN(played_at) AS earliest, MAX(played_at) AS latest,
            SUM(ms_played) AS ms
     FROM listening_events`,
  );

  return {
    totalRows: counts.total,
    musicRows: counts.music ?? 0,
    podcastRows: counts.podcast ?? 0,
    audiobookRows: counts.audiobook ?? 0,
    musicRowsMissingArtist: missing.noArtist ?? 0,
    musicRowsMissingTrack: missing.noTrack ?? 0,
    earliestEvent: range.earliest,
    latestEvent: range.latest,
    totalListeningHours: (range.ms ?? 0) / 3_600_000,
  };
}

export function printImportSummary(
  run: {
    filesProcessed: number;
    rowsRead: number;
    rowsInserted: number;
    duplicatesSkipped: number;
  },
  dbSummary: DbSummary,
): void {
  const s = dbSummary;
  console.log(`
import summary
--------------
files processed          ${run.filesProcessed}
raw rows read            ${run.rowsRead}
rows inserted            ${run.rowsInserted}
duplicates skipped       ${run.duplicatesSkipped}

database totals
---------------
total rows               ${s.totalRows}
music rows               ${s.musicRows}
podcast rows             ${s.podcastRows}
audiobook rows           ${s.audiobookRows}
music rows w/o artist    ${s.musicRowsMissingArtist}
music rows w/o track     ${s.musicRowsMissingTrack}
earliest event           ${s.earliestEvent ?? "—"}
latest event             ${s.latestEvent ?? "—"}
total listening hours    ${s.totalListeningHours.toFixed(1)}`);
}
