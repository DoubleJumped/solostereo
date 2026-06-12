import type Database from "better-sqlite3";
import { openDb } from "./db";

/**
 * Server-side data access layer (task 3.1): typed query functions over the
 * raw music view, parameterized by date range. All date bucketing is UTC
 * (plan.md §5.2). "Plays" means meaningful plays — music events with
 * ms_played >= 30000 (plan.md §8); raw plays are available alongside.
 *
 * The Overview reports music listening only; podcasts/audiobooks stay in the
 * raw table and out of these numbers.
 */

let _db: Database.Database | null = null;
function db(): Database.Database {
  if (!_db) {
    _db = openDb();
    _db.pragma("query_only = ON");
  }
  return _db;
}

/** Inclusive UTC date range; ISO dates (YYYY-MM-DD) or undefined for open. */
export interface DateRange {
  from?: string;
  to?: string;
}

export type RankMetric = "minutes" | "plays";

/** WHERE fragment + params for a played_at range over ISO timestamps. */
function rangeWhere(range: DateRange): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  if (range.from) {
    clauses.push("played_at >= ?");
    params.push(`${range.from}T00:00:00Z`);
  }
  if (range.to) {
    // inclusive end date: anything before the next UTC midnight
    clauses.push("played_at <= ?");
    params.push(`${range.to}T23:59:59.999Z`);
  }
  return {
    sql: clauses.length ? `AND ${clauses.join(" AND ")}` : "",
    params,
  };
}

export interface OverviewStats {
  meaningfulPlays: number;
  rawPlays: number;
  listeningHours: number;
  uniqueArtists: number;
  uniqueAlbums: number;
  uniqueTracks: number;
  firstEvent: string | null;
  lastEvent: string | null;
}

export function getOverviewStats(range: DateRange = {}): OverviewStats {
  const { sql, params } = rangeWhere(range);
  const r = db()
    .prepare(
      `SELECT
         SUM(ms_played >= 30000)                AS meaningfulPlays,
         COUNT(*)                               AS rawPlays,
         SUM(ms_played) / 3600000.0             AS listeningHours,
         COUNT(DISTINCT artist_name)            AS uniqueArtists,
         COUNT(DISTINCT artist_name || '|' || album_name) AS uniqueAlbums,
         COUNT(DISTINCT artist_name || '|' || track_name) AS uniqueTracks,
         MIN(played_at)                         AS firstEvent,
         MAX(played_at)                         AS lastEvent
       FROM music_listening_events
       WHERE 1=1 ${sql}`,
    )
    .get(...params) as OverviewStats & { meaningfulPlays: number | null };
  return {
    ...r,
    meaningfulPlays: r.meaningfulPlays ?? 0,
    listeningHours: r.listeningHours ?? 0,
  };
}

export interface TimeBucket {
  bucket: string; // "YYYY-MM" or "YYYY"
  listeningMinutes: number;
  meaningfulPlays: number;
}

export function getListeningOverTime(
  granularity: "month" | "year",
  range: DateRange = {},
): TimeBucket[] {
  const fmt = granularity === "month" ? "%Y-%m" : "%Y";
  const { sql, params } = rangeWhere(range);
  return db()
    .prepare(
      `SELECT strftime('${fmt}', played_at)     AS bucket,
              SUM(ms_played) / 60000.0          AS listeningMinutes,
              SUM(ms_played >= 30000)           AS meaningfulPlays
       FROM music_listening_events
       WHERE 1=1 ${sql}
       GROUP BY bucket
       ORDER BY bucket`,
    )
    .all(...params) as TimeBucket[];
}

export interface RankedArtist {
  artistName: string;
  meaningfulPlays: number;
  rawPlays: number;
  listeningMinutes: number;
}

export interface RankedAlbum extends RankedArtist {
  albumName: string;
}

export interface RankedTrack extends RankedArtist {
  trackName: string;
}

const METRIC_ORDER: Record<RankMetric, string> = {
  minutes: "listeningMinutes",
  plays: "meaningfulPlays",
};

export function getTopArtists(
  range: DateRange = {},
  metric: RankMetric = "minutes",
  limit = 10,
): RankedArtist[] {
  const { sql, params } = rangeWhere(range);
  return db()
    .prepare(
      `SELECT artist_name                       AS artistName,
              SUM(ms_played >= 30000)           AS meaningfulPlays,
              COUNT(*)                          AS rawPlays,
              SUM(ms_played) / 60000.0          AS listeningMinutes
       FROM music_listening_events
       WHERE artist_name IS NOT NULL ${sql}
       GROUP BY artist_name
       ORDER BY ${METRIC_ORDER[metric]} DESC
       LIMIT ?`,
    )
    .all(...params, limit) as RankedArtist[];
}

export function getTopAlbums(
  range: DateRange = {},
  metric: RankMetric = "minutes",
  limit = 10,
): RankedAlbum[] {
  const { sql, params } = rangeWhere(range);
  return db()
    .prepare(
      `SELECT artist_name                       AS artistName,
              album_name                        AS albumName,
              SUM(ms_played >= 30000)           AS meaningfulPlays,
              COUNT(*)                          AS rawPlays,
              SUM(ms_played) / 60000.0          AS listeningMinutes
       FROM music_listening_events
       WHERE artist_name IS NOT NULL AND album_name IS NOT NULL ${sql}
       GROUP BY artist_name, album_name
       ORDER BY ${METRIC_ORDER[metric]} DESC
       LIMIT ?`,
    )
    .all(...params, limit) as RankedAlbum[];
}

export function getTopTracks(
  range: DateRange = {},
  metric: RankMetric = "plays",
  limit = 10,
): RankedTrack[] {
  const { sql, params } = rangeWhere(range);
  return db()
    .prepare(
      `SELECT artist_name                       AS artistName,
              track_name                        AS trackName,
              SUM(ms_played >= 30000)           AS meaningfulPlays,
              COUNT(*)                          AS rawPlays,
              SUM(ms_played) / 60000.0          AS listeningMinutes
       FROM music_listening_events
       WHERE artist_name IS NOT NULL AND track_name IS NOT NULL ${sql}
       GROUP BY artist_name, track_name
       ORDER BY ${METRIC_ORDER[metric]} DESC
       LIMIT ?`,
    )
    .all(...params, limit) as RankedTrack[];
}

/** Years present in the data, descending — drives year selectors. */
export function getAvailableYears(): number[] {
  return (
    db()
      .prepare(
        `SELECT DISTINCT CAST(strftime('%Y', played_at) AS INTEGER) AS y
         FROM music_listening_events ORDER BY y DESC`,
      )
      .all() as { y: number }[]
  ).map((r) => r.y);
}
