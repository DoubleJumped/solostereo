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

/**
 * The default all-time view (no date filter). All-time reads are served from
 * the materialized summary tables (migration 006, refreshed on import/sync by
 * lib/summaries.ts) instead of scanning the 208k-row music view live —
 * better-sqlite3 blocks the event loop while it aggregates, which costs
 * ~1.6s per overview load locally and far more on Render's free CPU. Custom
 * date ranges still scan live; the idx_events_played_at index keeps those
 * fast. Numbers are identical either way.
 */
const isAllTime = (r: DateRange): boolean => !r.from && !r.to;

/** Materialized summary column for a metric (all-time fast paths). */
const METRIC_COLUMN: Record<RankMetric, string> = {
  minutes: "listening_minutes",
  plays: "meaningful_plays",
};

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
  if (isAllTime(range)) {
    const r = db()
      .prepare("SELECT * FROM overview_alltime")
      .get() as OverviewStats & { meaningfulPlays: number | null };
    return {
      ...r,
      meaningfulPlays: r.meaningfulPlays ?? 0,
      listeningHours: r.listeningHours ?? 0,
    };
  }
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
  if (isAllTime(range)) {
    // The materialized monthly/yearly summaries carry music-only columns
    // (music_ms_played, meaningful_plays) that match this query's output.
    const table =
      granularity === "month"
        ? "monthly_listening_summary"
        : "yearly_listening_summary";
    const bucketCol = granularity === "month" ? "month" : "year";
    return db()
      .prepare(
        `SELECT CAST(${bucketCol} AS TEXT)    AS bucket,
                music_ms_played / 60000.0     AS listeningMinutes,
                meaningful_plays              AS meaningfulPlays
         FROM ${table}
         ORDER BY ${bucketCol}`,
      )
      .all() as TimeBucket[];
  }
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
  if (isAllTime(range)) {
    return db()
      .prepare(
        `SELECT artist_name       AS artistName,
                meaningful_plays   AS meaningfulPlays,
                raw_plays          AS rawPlays,
                listening_minutes  AS listeningMinutes
         FROM artist_summary
         ORDER BY ${METRIC_COLUMN[metric]} DESC
         LIMIT ?`,
      )
      .all(limit) as RankedArtist[];
  }
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
  if (isAllTime(range)) {
    return db()
      .prepare(
        `SELECT artist_name       AS artistName,
                album_name         AS albumName,
                meaningful_plays   AS meaningfulPlays,
                raw_plays          AS rawPlays,
                listening_minutes  AS listeningMinutes
         FROM album_summary
         ORDER BY ${METRIC_COLUMN[metric]} DESC
         LIMIT ?`,
      )
      .all(limit) as RankedAlbum[];
  }
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
  if (isAllTime(range)) {
    return db()
      .prepare(
        `SELECT artist_name       AS artistName,
                track_name         AS trackName,
                meaningful_plays   AS meaningfulPlays,
                raw_plays          AS rawPlays,
                listening_minutes  AS listeningMinutes
         FROM track_summary
         ORDER BY ${METRIC_COLUMN[metric]} DESC
         LIMIT ?`,
      )
      .all(limit) as RankedTrack[];
  }
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

export interface SkippedTrackRow {
  artistName: string;
  trackName: string;
  meaningfulPlays: number;
  rawPlays: number;
  listeningMinutes: number;
  skips: number;
  /** Plays where the export recorded whether it was skipped (API-synced rows don't). */
  skipKnownPlays: number;
}

const SKIP_COLUMNS = `artist_name       AS artistName,
              track_name         AS trackName,
              meaningful_plays   AS meaningfulPlays,
              raw_plays          AS rawPlays,
              listening_minutes  AS listeningMinutes,
              skips,
              skip_known_plays   AS skipKnownPlays`;

/** Tracks ranked by how often they were skipped. */
export function getMostSkippedTracks(limit = 20): SkippedTrackRow[] {
  return db()
    .prepare(
      `SELECT ${SKIP_COLUMNS}
       FROM track_summary
       WHERE skips > 0
       ORDER BY skips DESC, skip_known_plays ASC
       LIMIT ?`,
    )
    .all(limit) as SkippedTrackRow[];
}

/**
 * Tracks never skipped once across at least `minPlays` plays with known skip
 * data — the threshold keeps one-listen wonders out.
 */
export function getNeverSkippedTracks(
  minPlays = 25,
  limit = 20,
): SkippedTrackRow[] {
  return db()
    .prepare(
      `SELECT ${SKIP_COLUMNS}
       FROM track_summary
       WHERE skips = 0 AND skip_known_plays >= ?
       ORDER BY meaningful_plays DESC, listening_minutes DESC
       LIMIT ?`,
    )
    .all(minPlays, limit) as SkippedTrackRow[];
}

export interface TrackSummaryRow {
  artistName: string;
  trackName: string;
  albumName: string | null;
  meaningfulPlays: number;
  rawPlays: number;
  listeningMinutes: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
  skips: number;
  skipKnownPlays: number;
}

export function getTrackSummary(
  artistName: string,
  trackName: string,
): TrackSummaryRow | null {
  return (
    (db()
      .prepare(
        `SELECT artist_name       AS artistName,
                track_name        AS trackName,
                album_name        AS albumName,
                meaningful_plays  AS meaningfulPlays,
                raw_plays         AS rawPlays,
                listening_minutes AS listeningMinutes,
                first_played_at   AS firstPlayedAt,
                last_played_at    AS lastPlayedAt,
                skips,
                skip_known_plays  AS skipKnownPlays
         FROM track_summary
         WHERE artist_name = ? AND track_name = ?`,
      )
      .get(artistName, trackName) as TrackSummaryRow | undefined) ?? null
  );
}

/** One track's listening by calendar year (same shape the artist arc uses). */
export function getTrackYears(
  artistName: string,
  trackName: string,
): ArtistYearBucket[] {
  return db()
    .prepare(
      `SELECT year,
              listening_minutes AS listeningMinutes,
              meaningful_plays  AS meaningfulPlays
       FROM track_year_summary
       WHERE artist_name = ? AND track_name = ?
       ORDER BY year`,
    )
    .all(artistName, trackName) as ArtistYearBucket[];
}

/** One track's listening by month across its whole history (live scan; the
 * artist index narrows it to that artist's rows). */
export function getTrackMonths(
  artistName: string,
  trackName: string,
): TimeBucket[] {
  return db()
    .prepare(
      `SELECT strftime('%Y-%m', played_at)  AS bucket,
              SUM(ms_played) / 60000.0      AS listeningMinutes,
              SUM(ms_played >= 30000)       AS meaningfulPlays
       FROM music_listening_events
       WHERE artist_name = ? AND track_name = ?
       GROUP BY bucket
       ORDER BY bucket`,
    )
    .all(artistName, trackName) as TimeBucket[];
}

/** Inclusive range covering one UTC calendar year. */
export function yearRange(year: number): DateRange {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export interface MonthTopArtist {
  month: string; // "01".."12"
  artistName: string;
  listeningMinutes: number;
}

/** The most-listened artist (by time) for each month of a year. */
export function getTopArtistPerMonth(year: number): MonthTopArtist[] {
  // Filter by played_at range (not strftime('%Y', ...) = ?) so the
  // idx_events_played_at index narrows the scan to one year of rows.
  return db()
    .prepare(
      `SELECT month, artist_name AS artistName, minutes AS listeningMinutes
       FROM (
         SELECT strftime('%m', played_at) AS month,
                artist_name,
                SUM(ms_played) / 60000.0 AS minutes,
                ROW_NUMBER() OVER (
                  PARTITION BY strftime('%m', played_at)
                  ORDER BY SUM(ms_played) DESC
                ) AS rn
         FROM music_listening_events
         WHERE played_at >= ? AND played_at < ? AND artist_name IS NOT NULL
         GROUP BY month, artist_name
       )
       WHERE rn = 1
       ORDER BY month`,
    )
    .all(`${year}-01-01`, `${year + 1}-01-01`) as MonthTopArtist[];
}

export interface ArtistTableRow {
  artistName: string;
  meaningfulPlays: number;
  rawPlays: number;
  listeningMinutes: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
  distinctTracks: number;
  activeYears: number;
  topYear: number;
  topTrack: string | null;
}

/** Every artist with the full §6 column set, for the explorer table. */
export function getArtistTable(): ArtistTableRow[] {
  return db()
    .prepare(
      `SELECT s.artist_name              AS artistName,
              s.meaningful_plays         AS meaningfulPlays,
              s.raw_plays                AS rawPlays,
              s.listening_minutes        AS listeningMinutes,
              s.first_played_at          AS firstPlayedAt,
              s.last_played_at           AS lastPlayedAt,
              s.distinct_tracks          AS distinctTracks,
              y.active_years             AS activeYears,
              y.top_year                 AS topYear,
              t.top_track                AS topTrack
       FROM artist_summary s
       LEFT JOIN (
         SELECT artist_name,
                COUNT(DISTINCT year) AS active_years,
                MAX(CASE WHEN rn = 1 THEN year END) AS top_year
         FROM (
           SELECT artist_name, year,
                  ROW_NUMBER() OVER (
                    PARTITION BY artist_name ORDER BY total_ms_played DESC
                  ) AS rn
           FROM artist_year_summary
         )
         GROUP BY artist_name
       ) y ON y.artist_name = s.artist_name
       LEFT JOIN (
         SELECT artist_name, track_name AS top_track
         FROM (
           SELECT artist_name, track_name,
                  ROW_NUMBER() OVER (
                    PARTITION BY artist_name
                    ORDER BY meaningful_plays DESC, total_ms_played DESC
                  ) AS rn
           FROM track_summary
         )
         WHERE rn = 1
       ) t ON t.artist_name = s.artist_name
       ORDER BY s.listening_minutes DESC`,
    )
    .all() as ArtistTableRow[];
}

export interface ArtistYearBucket {
  year: number;
  listeningMinutes: number;
  meaningfulPlays: number;
}

/** One artist's listening by calendar year (the relationship arc). */
export function getArtistYears(artistName: string): ArtistYearBucket[] {
  return db()
    .prepare(
      `SELECT year,
              listening_minutes AS listeningMinutes,
              meaningful_plays  AS meaningfulPlays
       FROM artist_year_summary
       WHERE artist_name = ?
       ORDER BY year`,
    )
    .all(artistName) as ArtistYearBucket[];
}

/** One artist's listening by month across their whole history. */
export function getArtistMonths(artistName: string): TimeBucket[] {
  return db()
    .prepare(
      `SELECT strftime('%Y-%m', played_at)  AS bucket,
              SUM(ms_played) / 60000.0      AS listeningMinutes,
              SUM(ms_played >= 30000)       AS meaningfulPlays
       FROM music_listening_events
       WHERE artist_name = ?
       GROUP BY bucket
       ORDER BY bucket`,
    )
    .all(artistName) as TimeBucket[];
}

export interface ArtistSummaryRow {
  artistName: string;
  meaningfulPlays: number;
  rawPlays: number;
  listeningMinutes: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
  distinctTracks: number;
}

export function getArtistSummary(artistName: string): ArtistSummaryRow | null {
  return (
    (db()
      .prepare(
        `SELECT artist_name       AS artistName,
                meaningful_plays  AS meaningfulPlays,
                raw_plays         AS rawPlays,
                listening_minutes AS listeningMinutes,
                first_played_at   AS firstPlayedAt,
                last_played_at    AS lastPlayedAt,
                distinct_tracks   AS distinctTracks
         FROM artist_summary
         WHERE artist_name = ?`,
      )
      .get(artistName) as ArtistSummaryRow | undefined) ?? null
  );
}

/** Top albums for one artist (by listening time). */
export function getArtistAlbums(artistName: string, limit = 10): RankedAlbum[] {
  return db()
    .prepare(
      `SELECT artist_name       AS artistName,
              album_name        AS albumName,
              meaningful_plays  AS meaningfulPlays,
              raw_plays         AS rawPlays,
              listening_minutes AS listeningMinutes
       FROM album_summary
       WHERE artist_name = ?
       ORDER BY total_ms_played DESC
       LIMIT ?`,
    )
    .all(artistName, limit) as RankedAlbum[];
}

/** Top tracks for one artist (by meaningful plays). */
export function getArtistTracks(artistName: string, limit = 10): RankedTrack[] {
  return db()
    .prepare(
      `SELECT artist_name       AS artistName,
              track_name        AS trackName,
              meaningful_plays  AS meaningfulPlays,
              raw_plays         AS rawPlays,
              listening_minutes AS listeningMinutes
       FROM track_summary
       WHERE artist_name = ?
       ORDER BY meaningful_plays DESC, total_ms_played DESC
       LIMIT ?`,
    )
    .all(artistName, limit) as RankedTrack[];
}

export interface ArtistYearDelta {
  artistName: string;
  minutesA: number;
  minutesB: number;
  playsA: number;
  playsB: number;
  deltaMinutes: number;
}

/**
 * Every artist active in either of two years, with listening totals for both
 * and the delta (B − A). Drives the rises/falls and prominent-in-both lists.
 */
export function getArtistYearDeltas(
  yearA: number,
  yearB: number,
): ArtistYearDelta[] {
  return db()
    .prepare(
      `SELECT COALESCE(a.artist_name, b.artist_name)  AS artistName,
              IFNULL(a.listening_minutes, 0)          AS minutesA,
              IFNULL(b.listening_minutes, 0)          AS minutesB,
              IFNULL(a.meaningful_plays, 0)           AS playsA,
              IFNULL(b.meaningful_plays, 0)           AS playsB,
              IFNULL(b.listening_minutes, 0) - IFNULL(a.listening_minutes, 0)
                                                      AS deltaMinutes
       FROM (SELECT * FROM artist_year_summary WHERE year = ?) a
       FULL OUTER JOIN (SELECT * FROM artist_year_summary WHERE year = ?) b
         ON a.artist_name = b.artist_name
       ORDER BY deltaMinutes DESC`,
    )
    .all(yearA, yearB) as ArtistYearDelta[];
}

export interface YearArtistTrack {
  trackName: string;
  meaningfulPlays: number;
  listeningMinutes: number;
}

/**
 * For one year, each artist's top tracks that year (default 4 per artist),
 * keyed by artist name. Powers the hover detail on the year page's artist
 * ranking.
 */
export function getYearArtistTopTracks(
  year: number,
  perArtist = 4,
): Map<string, YearArtistTrack[]> {
  const rows = db()
    .prepare(
      `SELECT artist_name AS artistName, track_name AS trackName,
              meaningful_plays AS meaningfulPlays,
              listening_minutes AS listeningMinutes
       FROM (
         SELECT artist_name, track_name, meaningful_plays, listening_minutes,
                ROW_NUMBER() OVER (
                  PARTITION BY artist_name
                  ORDER BY meaningful_plays DESC, total_ms_played DESC
                ) AS rn
         FROM track_year_summary
         WHERE year = ?
       )
       WHERE rn <= ?
       ORDER BY artist_name, meaningfulPlays DESC`,
    )
    .all(year, perArtist) as (YearArtistTrack & { artistName: string })[];

  const map = new Map<string, YearArtistTrack[]>();
  for (const r of rows) {
    const list = map.get(r.artistName) ?? [];
    list.push({
      trackName: r.trackName,
      meaningfulPlays: r.meaningfulPlays,
      listeningMinutes: r.listeningMinutes,
    });
    map.set(r.artistName, list);
  }
  return map;
}

/** Years present in the data, descending — drives year selectors. */
export function getAvailableYears(): number[] {
  // artist_year_summary is materialized and music-only, so this is a tiny
  // table read instead of an all-history scan.
  return (
    db()
      .prepare(
        `SELECT DISTINCT year AS y FROM artist_year_summary ORDER BY y DESC`,
      )
      .all() as { y: number }[]
  ).map((r) => r.y);
}
