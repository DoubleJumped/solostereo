import type Database from "better-sqlite3";
import { openDb } from "./db";

/**
 * Playlist recipe engine (task 8A.2): behaviour-only generators that turn the
 * listening history into candidate playlists, scored and bucketed in plain TS.
 *
 * Recipes operate on `music_listening_events` and count **meaningful plays**
 * only — music events with `ms_played >= 30000` (plan.md §8). All date
 * bucketing is UTC (plan.md §5.2). Read-only: this module reuses the same
 * cached `query_only` connection pattern as lib/queries.ts.
 *
 * v1 recipes (plan.md §10, Phase 8A): **Obsessions** (velocity bursts that
 * went quiet) and **Lapsed loves** (heavy historically, quiet recently).
 */

let _db: Database.Database | null = null;
function db(): Database.Database {
  if (!_db) {
    _db = openDb();
    _db.pragma("query_only = ON");
  }
  return _db;
}

/** A single scored candidate for a generated playlist. */
export interface CandidateTrack {
  uri: string; // spotify_track_uri
  artist: string | null;
  track: string | null;
  album: string | null;
  score: number;
  reason: string; // human-readable why-picked
}

/** A generated playlist (a recipe may produce several — e.g. one per year). */
export interface GeneratedPlaylist {
  name: string;
  description: string;
  recipeKey: string;
  params: Record<string, unknown>;
  tracks: CandidateTrack[];
}

/** A recipe: tunable params in, one or more generated playlists out. */
export interface Recipe<P = Record<string, unknown>> {
  key: string;
  label: string;
  description: string;
  defaultParams: P;
  generate(params: P): GeneratedPlaylist[];
}

const DAY_MS = 86_400_000;
const WINDOW_MS = 30 * DAY_MS;

/** UTC year of an ISO timestamp. */
function utcYear(iso: string): number {
  return new Date(iso).getUTCFullYear();
}

/** UTC calendar day key (YYYY-MM-DD) of an ISO timestamp. */
function utcDayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** "Mon YYYY" label for an ISO timestamp, in UTC. */
function monthYearLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today minus N whole months, as a UTC millisecond timestamp. */
function monthsAgoMs(months: number): number {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, now.getUTCDate()),
  );
  return d.getTime();
}

interface PlayRow {
  uri: string;
  played_at: string;
  artist_name: string | null;
  track_name: string | null;
  album_name: string | null;
}

/** Densest 30-day window over a track's sorted play timestamps. */
interface PeakWindow {
  peakWindowPlays: number;
  startIso: string;
  burstDays: number;
}

function peakWindow(playedAt: number[], isos: string[]): PeakWindow {
  let bestCount = 0;
  let bestStart = 0;
  let i = 0;
  for (let j = 0; j < playedAt.length; j++) {
    while (playedAt[j] - playedAt[i] > WINDOW_MS) i++;
    const count = j - i + 1;
    if (count > bestCount) {
      bestCount = count;
      bestStart = i;
    }
  }
  // Distinct UTC calendar days inside the winning window.
  const days = new Set<string>();
  const limit = bestStart + bestCount;
  for (let k = bestStart; k < limit; k++) days.add(utcDayKey(isos[k]));
  return {
    peakWindowPlays: bestCount,
    startIso: isos[bestStart] ?? "",
    burstDays: days.size,
  };
}

export interface ObsessionsParams {
  /** Min plays in the peak 30-day window to count as a burst. */
  minBurst: number;
  /** Min distinct calendar days the burst must span. */
  minBurstDays: number;
  /** Min share of lifetime plays that fall in the peak window (0..1). */
  concentration: number;
  /** Track must have had no meaningful play in the last N months. */
  quietMonths: number;
  /** Max tracks per generated (per-year) playlist. */
  size: number;
  /** Max tracks from any one artist per playlist. */
  perArtistCap: number;
  /** If set, only generate the playlist for this UTC year. */
  year?: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const OBSESSIONS_DEFAULTS: ObsessionsParams = {
  minBurst: 6,
  minBurstDays: 3,
  concentration: 0.6,
  quietMonths: 12,
  size: 30,
  perArtistCap: 3,
};

interface QualifyingTrack {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  score: number;
  peakWindowPlays: number;
  burstDays: number;
  startIso: string;
  year: number;
}

/**
 * Obsessions: tracks that burst hard over ~30 days and then went quiet.
 *
 * For each track (grouped from one ordered scan of meaningful plays) we find
 * the densest 30-day window, then qualify it when the burst was big enough
 * (`minBurst`), spread over enough days (`minBurstDays`), concentrated enough
 * relative to its lifetime plays (`concentration`), and the track has since
 * gone silent for `quietMonths`. Qualifying tracks are bucketed by the UTC
 * year of their peak window's start, ranked by score within each year (with a
 * per-artist cap), and returned as one playlist per year, newest first.
 */
function generateObsessions(params: ObsessionsParams): GeneratedPlaylist[] {
  const {
    minBurst,
    minBurstDays,
    concentration,
    quietMonths,
    size,
    perArtistCap,
    year,
  } = params;

  const quietCutoffMs = monthsAgoMs(quietMonths);

  const rows = db()
    .prepare(
      `SELECT spotify_track_uri AS uri,
              played_at,
              artist_name,
              track_name,
              album_name
       FROM music_listening_events
       WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
       ORDER BY spotify_track_uri, played_at`,
    )
    .all() as PlayRow[];

  const qualifying: QualifyingTrack[] = [];

  let start = 0;
  while (start < rows.length) {
    let end = start;
    const uri = rows[start].uri;
    while (end < rows.length && rows[end].uri === uri) end++;
    const group = rows.slice(start, end);
    start = end;

    const lifetimePlays = group.length;
    const isos = group.map((r) => r.played_at);
    const times = isos.map((s) => new Date(s).getTime());
    const lastPlayedMs = times[times.length - 1]; // sorted ascending

    // Still active recently → not an abandoned obsession.
    if (lastPlayedMs >= quietCutoffMs) continue;

    const peak = peakWindow(times, isos);
    const concentrationActual = peak.peakWindowPlays / lifetimePlays;

    if (
      peak.peakWindowPlays >= minBurst &&
      peak.burstDays >= minBurstDays &&
      concentrationActual >= concentration
    ) {
      const display = pickDisplay(group);
      qualifying.push({
        uri,
        artist: display.artist,
        track: display.track,
        album: display.album,
        score: peak.peakWindowPlays * concentrationActual,
        peakWindowPlays: peak.peakWindowPlays,
        burstDays: peak.burstDays,
        startIso: peak.startIso,
        year: utcYear(peak.startIso),
      });
    }
  }

  // Bucket by peak-window year.
  const byYear = new Map<number, QualifyingTrack[]>();
  for (const t of qualifying) {
    if (year !== undefined && t.year !== year) continue;
    const list = byYear.get(t.year) ?? [];
    list.push(t);
    byYear.set(t.year, list);
  }

  const years = [...byYear.keys()].sort((a, b) => b - a); // newest first
  const playlists: GeneratedPlaylist[] = [];

  for (const y of years) {
    const candidates = byYear.get(y)!.sort((a, b) => b.score - a.score);
    const perArtist = new Map<string, number>();
    const picked: CandidateTrack[] = [];

    for (const t of candidates) {
      if (picked.length >= size) break;
      const artistKey = t.artist ?? "";
      const used = perArtist.get(artistKey) ?? 0;
      if (used >= perArtistCap) continue;
      perArtist.set(artistKey, used + 1);
      picked.push({
        uri: t.uri,
        artist: t.artist,
        track: t.track,
        album: t.album,
        score: t.score,
        reason: `${t.peakWindowPlays} plays over ${t.burstDays} days, peak ${monthYearLabel(t.startIso)}`,
      });
    }

    playlists.push({
      name: `Obsessions of ${y}`,
      description:
        `Tracks I binged in ${y} and then abandoned — ` +
        `a ${minBurst}+ play burst over ${minBurstDays}+ days, ` +
        `${Math.round(concentration * 100)}%+ concentrated, ` +
        `then silent for ${quietMonths}+ months.`,
      recipeKey: "obsessions",
      params: { ...params, year: y },
      tracks: picked,
    });
  }

  return playlists;
}

/** Most-frequent (else first) artist/track/album for a track's play group. */
function pickDisplay(group: PlayRow[]): {
  artist: string | null;
  track: string | null;
  album: string | null;
} {
  return {
    artist: mostFrequent(group.map((r) => r.artist_name)),
    track: mostFrequent(group.map((r) => r.track_name)),
    album: mostFrequent(group.map((r) => r.album_name)),
  };
}

function mostFrequent(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  let best: string | null = null;
  let bestN = 0;
  for (const v of values) {
    if (v == null) continue;
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      bestN = n;
      best = v;
    }
  }
  return best;
}

export const OBSESSIONS: Recipe<ObsessionsParams> = {
  key: "obsessions",
  label: "Obsessions",
  description:
    "Tracks I played obsessively over a short stretch and then abandoned — " +
    "velocity bursts that went quiet, one playlist per year.",
  defaultParams: OBSESSIONS_DEFAULTS,
  generate: generateObsessions,
};

export interface LapsedLovesParams {
  /** Min lifetime meaningful plays to count as a historical love. */
  minPlays: number;
  /** Track must have had no meaningful play in the last N months. */
  lapseMonths: number;
  /** Max tracks in the generated playlist. */
  size: number;
  /** Max tracks from any one artist. */
  perArtistCap: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const LAPSED_LOVES_DEFAULTS: LapsedLovesParams = {
  minPlays: 8,
  lapseMonths: 18,
  size: 40,
  perArtistCap: 2,
};

/** One uri's lifetime aggregate from the GROUP BY scan. */
interface LapsedRow {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  lifetimePlays: number;
  lastPlayed: string; // MAX(played_at), ISO
}

/**
 * Lapsed loves: tracks with high historical affinity that have gone quiet.
 *
 * Over meaningful plays we aggregate each uri's lifetime play count and the
 * most recent time it was heard. A track qualifies when it cleared `minPlays`
 * historically AND hasn't had a meaningful play in `lapseMonths` months. The
 * score `lifetimePlays * sqrt(monthsSinceLastPlayed)` rewards both heavy past
 * play and longer absence, so a once-loved track that's been silent for years
 * outranks a slightly-more-played one set aside only recently. Ranked by score
 * desc with a per-artist cap, returned as a single playlist. UTC throughout.
 */
function generateLapsedLoves(params: LapsedLovesParams): GeneratedPlaylist[] {
  const { minPlays, lapseMonths, size, perArtistCap } = params;

  const lapseCutoffMs = monthsAgoMs(lapseMonths);
  const nowMs = Date.now();

  // Aggregate per uri: lifetime play count, last-played, and a representative
  // (most-frequent) artist/track/album picked in SQL via a grouped subquery.
  const rows = db()
    .prepare(
      `WITH plays AS (
         SELECT spotify_track_uri AS uri,
                artist_name,
                track_name,
                album_name,
                played_at
         FROM music_listening_events
         WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
       ),
       agg AS (
         SELECT uri,
                COUNT(*)        AS lifetimePlays,
                MAX(played_at)  AS lastPlayed
         FROM plays
         GROUP BY uri
       ),
       names AS (
         SELECT uri, artist_name, track_name, album_name,
                ROW_NUMBER() OVER (
                  PARTITION BY uri
                  ORDER BY COUNT(*) DESC, MAX(played_at) DESC
                ) AS rn
         FROM plays
         GROUP BY uri, artist_name, track_name, album_name
       )
       SELECT agg.uri              AS uri,
              names.artist_name    AS artist,
              names.track_name     AS track,
              names.album_name     AS album,
              agg.lifetimePlays    AS lifetimePlays,
              agg.lastPlayed       AS lastPlayed
       FROM agg
       JOIN names ON names.uri = agg.uri AND names.rn = 1
       WHERE agg.lifetimePlays >= ?
       ORDER BY agg.lifetimePlays DESC`,
    )
    .all(minPlays) as LapsedRow[];

  const candidates: CandidateTrack[] = [];

  for (const r of rows) {
    const lastPlayedMs = new Date(r.lastPlayed).getTime();
    // Still heard recently → not lapsed.
    if (lastPlayedMs >= lapseCutoffMs) continue;

    const monthsSince = (nowMs - lastPlayedMs) / (30 * DAY_MS);
    const score = r.lifetimePlays * Math.sqrt(monthsSince);

    candidates.push({
      uri: r.uri,
      artist: r.artist,
      track: r.track,
      album: r.album,
      score,
      reason: `Played ${r.lifetimePlays} times, last heard ${monthYearLabel(r.lastPlayed)}`,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const perArtist = new Map<string, number>();
  const picked: CandidateTrack[] = [];
  for (const c of candidates) {
    if (picked.length >= size) break;
    const artistKey = c.artist ?? "";
    const used = perArtist.get(artistKey) ?? 0;
    if (used >= perArtistCap) continue;
    perArtist.set(artistKey, used + 1);
    picked.push(c);
  }

  return [
    {
      name: "Lapsed loves",
      description:
        `Tracks I played a lot (${minPlays}+ times) but haven't heard in ` +
        `${lapseMonths}+ months — high historical affinity, gone quiet.`,
      recipeKey: "lapsedLoves",
      params: { ...params },
      tracks: picked,
    },
  ];
}

export const LAPSED_LOVES: Recipe<LapsedLovesParams> = {
  key: "lapsedLoves",
  label: "Lapsed loves",
  description:
    "Tracks I played a lot historically but haven't heard in a long time — " +
    "high lifetime affinity that's since gone quiet.",
  defaultParams: LAPSED_LOVES_DEFAULTS,
  generate: generateLapsedLoves,
};

export interface DeepCutsParams {
  /** Min total meaningful plays for an artist to be a "favourite". */
  minArtistPlays: number;
  /** Which within-artist play ranks count as deep cuts (1 = the #1 hit). */
  ranks: number[];
  /** Max deep cuts taken from any one artist. */
  perArtist: number;
  /** Only consider the top N favourite artists by total meaningful plays. */
  topArtists: number;
  /** Max tracks in the generated playlist. */
  size: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const DEEP_CUTS_DEFAULTS: DeepCutsParams = {
  minArtistPlays: 60,
  ranks: [2, 3, 4],
  perArtist: 3,
  topArtists: 30,
  size: 60,
};

/** One uri's within-artist rank from the windowed aggregate. */
interface DeepCutRow {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  plays: number; // this uri's meaningful plays
  rank: number; // 1 = artist's most-played track
  artistPlays: number; // artist's total meaningful plays
}

/**
 * Deep cuts: for each favourite artist, the tracks ranked 2nd/3rd/4th by my
 * meaningful plays — the songs I love past the obvious #1 hit.
 *
 * Artists are favourites once their total meaningful plays clear
 * `minArtistPlays`; only the top `topArtists` by that total are considered.
 * Within each artist we rank tracks (by `spotify_track_uri`) on meaningful
 * plays desc and keep those whose rank lands in `ranks` (default 2nd–4th), up
 * to `perArtist` per artist. A representative artist/track/album name is picked
 * per uri in SQL. The combined set is sorted by the track's own meaningful
 * plays desc and capped at `size`, returned as a single playlist. UTC, via the
 * meaningful-play (`ms_played >= 30000`) filter on `music_listening_events`.
 */
function generateDeepCuts(params: DeepCutsParams): GeneratedPlaylist[] {
  const { minArtistPlays, ranks, perArtist, topArtists, size } = params;

  // Per-uri meaningful-play aggregate with a within-artist rank, plus the
  // artist's total meaningful plays (restricted to favourite artists). A
  // representative name per uri is chosen by play count via a grouped subquery.
  const rows = db()
    .prepare(
      `WITH plays AS (
         SELECT spotify_track_uri AS uri,
                artist_name,
                track_name,
                album_name,
                played_at
         FROM music_listening_events
         WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
           AND artist_name IS NOT NULL
       ),
       artist_totals AS (
         SELECT artist_name, COUNT(*) AS artistPlays
         FROM plays
         GROUP BY artist_name
         HAVING COUNT(*) >= ?
         ORDER BY artistPlays DESC
         LIMIT ?
       ),
       uri_agg AS (
         SELECT p.uri,
                p.artist_name,
                COUNT(*) AS plays
         FROM plays p
         JOIN artist_totals a ON a.artist_name = p.artist_name
         GROUP BY p.uri
       ),
       ranked AS (
         SELECT uri,
                artist_name,
                plays,
                ROW_NUMBER() OVER (
                  PARTITION BY artist_name
                  ORDER BY plays DESC, uri
                ) AS rank
         FROM uri_agg
       ),
       names AS (
         SELECT uri, artist_name, track_name, album_name,
                ROW_NUMBER() OVER (
                  PARTITION BY uri
                  ORDER BY COUNT(*) DESC, MAX(played_at) DESC
                ) AS rn
         FROM plays
         GROUP BY uri, artist_name, track_name, album_name
       )
       SELECT ranked.uri            AS uri,
              names.artist_name     AS artist,
              names.track_name      AS track,
              names.album_name      AS album,
              ranked.plays          AS plays,
              ranked.rank           AS rank,
              artist_totals.artistPlays AS artistPlays
       FROM ranked
       JOIN names ON names.uri = ranked.uri AND names.rn = 1
       JOIN artist_totals ON artist_totals.artist_name = ranked.artist_name
       ORDER BY ranked.plays DESC`,
    )
    .all(minArtistPlays, topArtists) as DeepCutRow[];

  const rankSet = new Set(ranks);

  const candidates: (CandidateTrack & { artistKey: string })[] = [];
  for (const r of rows) {
    if (!rankSet.has(r.rank)) continue;
    candidates.push({
      uri: r.uri,
      artist: r.artist,
      track: r.track,
      album: r.album,
      score: r.plays,
      reason: `your #${r.rank} most-played ${r.artist ?? "?"} track (${r.plays} plays)`,
      artistKey: r.artist ?? "",
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const perArtistCount = new Map<string, number>();
  const picked: CandidateTrack[] = [];
  for (const c of candidates) {
    if (picked.length >= size) break;
    const used = perArtistCount.get(c.artistKey) ?? 0;
    if (used >= perArtist) continue;
    perArtistCount.set(c.artistKey, used + 1);
    const { artistKey: _artistKey, ...track } = c;
    void _artistKey;
    picked.push(track);
  }

  return [
    {
      name: "Deep cuts",
      description:
        `For my favourite artists (${minArtistPlays}+ plays), the tracks ranked ` +
        `${ranks.join("/")} by my plays — the songs I love past the obvious #1 hit.`,
      recipeKey: "deepCuts",
      params: { ...params },
      tracks: picked,
    },
  ];
}

export const DEEP_CUTS: Recipe<DeepCutsParams> = {
  key: "deepCuts",
  label: "Deep cuts",
  description:
    "For my favourite artists, their 2nd/3rd/4th most-played tracks — the " +
    "songs I love beyond the obvious #1 hit.",
  defaultParams: DEEP_CUTS_DEFAULTS,
  generate: generateDeepCuts,
};

export interface OneHitObsessionsParams {
  /** Min total meaningful plays for an artist to qualify. */
  minArtistPlays: number;
  /** Min share (0..1) of the artist's plays the top track must hold. */
  dominance: number;
  /**
   * Min distinct tracks I've played by the artist. Keeps the recipe to the
   * interesting case — a real catalogue where one song still dominates —
   * rather than artists I only ever played one song by.
   */
  minDistinctTracks: number;
  /** Max tracks in the generated playlist. */
  size: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const ONE_HIT_OBSESSIONS_DEFAULTS: OneHitObsessionsParams = {
  minArtistPlays: 25,
  dominance: 0.6,
  minDistinctTracks: 3,
  size: 50,
};

/** One artist's dominating top track from the aggregate. */
interface OneHitRow {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  topPlays: number; // top track's meaningful plays
  artistPlays: number; // artist's total meaningful plays
  distinctTracks: number; // distinct tracks I've played by the artist
}

/**
 * One-hit obsessions: artists where a single track dominates my plays of them —
 * my personal one-hit wonders.
 *
 * For each artist clearing `minArtistPlays` total meaningful plays we find their
 * top track (by meaningful plays) and that track's share of the artist's total.
 * The artist qualifies when the share is at least `dominance`, and we include
 * that one dominating track. Scored by `share * artistPlays` (so a dominant
 * track from a heavily-played artist outranks one from a lightly-played artist),
 * sorted by share desc then plays desc, capped at `size`, as a single playlist.
 * Names are chosen per uri in SQL. UTC, meaningful plays only.
 */
function generateOneHitObsessions(
  params: OneHitObsessionsParams,
): GeneratedPlaylist[] {
  const { minArtistPlays, dominance, minDistinctTracks, size } = params;

  // Per-artist: total plays, and the top track's uri + plays via a windowed
  // rank over per-uri aggregates. Representative names chosen per uri in SQL.
  const rows = db()
    .prepare(
      `WITH plays AS (
         SELECT spotify_track_uri AS uri,
                artist_name,
                track_name,
                album_name,
                played_at
         FROM music_listening_events
         WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
           AND artist_name IS NOT NULL
       ),
       artist_totals AS (
         SELECT artist_name,
                COUNT(*) AS artistPlays,
                COUNT(DISTINCT uri) AS distinctTracks
         FROM plays
         GROUP BY artist_name
         HAVING COUNT(*) >= ? AND COUNT(DISTINCT uri) >= ?
       ),
       uri_agg AS (
         SELECT uri, artist_name, COUNT(*) AS plays
         FROM plays
         GROUP BY uri
       ),
       ranked AS (
         SELECT u.uri,
                u.artist_name,
                u.plays,
                ROW_NUMBER() OVER (
                  PARTITION BY u.artist_name
                  ORDER BY u.plays DESC, u.uri
                ) AS rank
         FROM uri_agg u
         JOIN artist_totals a ON a.artist_name = u.artist_name
       ),
       names AS (
         SELECT uri, artist_name, track_name, album_name,
                ROW_NUMBER() OVER (
                  PARTITION BY uri
                  ORDER BY COUNT(*) DESC, MAX(played_at) DESC
                ) AS rn
         FROM plays
         GROUP BY uri, artist_name, track_name, album_name
       )
       SELECT ranked.uri            AS uri,
              names.artist_name     AS artist,
              names.track_name      AS track,
              names.album_name      AS album,
              ranked.plays          AS topPlays,
              artist_totals.artistPlays AS artistPlays,
              artist_totals.distinctTracks AS distinctTracks
       FROM ranked
       JOIN names ON names.uri = ranked.uri AND names.rn = 1
       JOIN artist_totals ON artist_totals.artist_name = ranked.artist_name
       WHERE ranked.rank = 1`,
    )
    .all(minArtistPlays, minDistinctTracks) as OneHitRow[];

  const qualifying: (CandidateTrack & { share: number })[] = [];
  for (const r of rows) {
    const share = r.topPlays / r.artistPlays;
    if (share < dominance) continue;
    qualifying.push({
      uri: r.uri,
      artist: r.artist,
      track: r.track,
      album: r.album,
      score: share * r.artistPlays,
      reason: `${Math.round(share * 100)}% of your ${r.artist ?? "?"} plays — '${r.track ?? "?"}' (${r.topPlays} of ${r.artistPlays}, across ${r.distinctTracks} of their songs)`,
      share,
    });
  }

  // Share desc, then top-track plays (encoded in score relative to share) desc.
  qualifying.sort((a, b) => b.share - a.share || b.score - a.score);

  const picked: CandidateTrack[] = qualifying
    .slice(0, size)
    .map(({ share: _share, ...track }) => {
      void _share;
      return track;
    });

  return [
    {
      name: "One-hit obsessions",
      description:
        `Artists I've played ${minDistinctTracks}+ songs by (${minArtistPlays}+ plays) ` +
        `where a single track is still ${Math.round(dominance * 100)}%+ of ` +
        `everything I played by them — my personal one-hit wonders.`,
      recipeKey: "oneHitObsessions",
      params: { ...params },
      tracks: picked,
    },
  ];
}

export const ONE_HIT_OBSESSIONS: Recipe<OneHitObsessionsParams> = {
  key: "oneHitObsessions",
  label: "One-hit obsessions",
  description:
    "Artists where a single track dominates my plays of them — my personal " +
    "one-hit wonders.",
  defaultParams: ONE_HIT_OBSESSIONS_DEFAULTS,
  generate: generateOneHitObsessions,
};

export interface OldAndNewParams {
  /** Min total meaningful plays for an artist to count as a "favourite". */
  minArtistPlays: number;
  /** Min distinct UTC calendar years the artist must have been active in. */
  minArtistYears: number;
  /** Only consider the top N favourite artists by total meaningful plays. */
  artists: number;
  /** A track needs this many meaningful plays to be eligible as old/new. */
  perArtistTrackMinPlays: number;
  /** Max tracks in the generated playlist. */
  size: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const OLD_AND_NEW_DEFAULTS: OldAndNewParams = {
  minArtistPlays: 80,
  minArtistYears: 3,
  artists: 20,
  perArtistTrackMinPlays: 5,
  size: 40,
};

/** One uri's first-play and play count for an old/new candidate. */
interface OldNewTrackRow {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  plays: number; // this uri's meaningful plays
  firstPlayed: string; // MIN(played_at) over the uri's meaningful plays, ISO
  artistPlays: number; // artist's total meaningful plays
}

/**
 * Old & new: for each favourite artist, the track I discovered earliest paired
 * with the one I discovered most recently — my taste in that artist across time.
 *
 * Favourite artists clear `minArtistPlays` total meaningful plays AND were
 * active in at least `minArtistYears` distinct UTC calendar years; only the top
 * `artists` by total plays are considered. Within each artist we look at tracks
 * (by `spotify_track_uri`) with at least `perArtistTrackMinPlays` meaningful
 * plays and use each uri's first-play time (`MIN(played_at)`) to pick the "old"
 * track (earliest first-play) and the "new" track (latest first-play). If both
 * resolve to the same uri the artist contributes that one track once. The
 * playlist interleaves per artist — [A-old, A-new, B-old, B-new, …] — so each
 * pair sits together, with artists ordered by total plays desc, capped at
 * `size`. `score` is the artist's total plays so the biggest artists lead.
 * Names are chosen per uri in SQL. UTC, meaningful plays only.
 */
function generateOldAndNew(params: OldAndNewParams): GeneratedPlaylist[] {
  const { minArtistPlays, minArtistYears, artists, perArtistTrackMinPlays, size } =
    params;

  // Per-uri meaningful-play aggregate with first-play time, restricted to
  // favourite artists (total plays + distinct active years), plus the artist's
  // total plays. Representative names per uri chosen by play count in SQL.
  const rows = db()
    .prepare(
      `WITH plays AS (
         SELECT spotify_track_uri AS uri,
                artist_name,
                track_name,
                album_name,
                played_at
         FROM music_listening_events
         WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
           AND artist_name IS NOT NULL
       ),
       artist_totals AS (
         SELECT artist_name, COUNT(*) AS artistPlays
         FROM plays
         GROUP BY artist_name
         HAVING COUNT(*) >= ?
            AND COUNT(DISTINCT strftime('%Y', played_at)) >= ?
         ORDER BY artistPlays DESC
         LIMIT ?
       ),
       uri_agg AS (
         SELECT p.uri,
                p.artist_name,
                COUNT(*)       AS plays,
                MIN(p.played_at) AS firstPlayed
         FROM plays p
         JOIN artist_totals a ON a.artist_name = p.artist_name
         GROUP BY p.uri
         HAVING COUNT(*) >= ?
       ),
       names AS (
         SELECT uri, artist_name, track_name, album_name,
                ROW_NUMBER() OVER (
                  PARTITION BY uri
                  ORDER BY COUNT(*) DESC, MAX(played_at) DESC
                ) AS rn
         FROM plays
         GROUP BY uri, artist_name, track_name, album_name
       )
       SELECT uri_agg.uri          AS uri,
              names.artist_name    AS artist,
              names.track_name     AS track,
              names.album_name     AS album,
              uri_agg.plays        AS plays,
              uri_agg.firstPlayed  AS firstPlayed,
              artist_totals.artistPlays AS artistPlays
       FROM uri_agg
       JOIN names ON names.uri = uri_agg.uri AND names.rn = 1
       JOIN artist_totals ON artist_totals.artist_name = uri_agg.artist_name
       ORDER BY artist_totals.artistPlays DESC, uri_agg.firstPlayed`,
    )
    .all(minArtistPlays, minArtistYears, artists, perArtistTrackMinPlays) as OldNewTrackRow[];

  // Group eligible tracks by artist, preserving the artist-plays-desc order.
  const byArtist = new Map<string, OldNewTrackRow[]>();
  const artistPlays = new Map<string, number>();
  for (const r of rows) {
    const key = r.artist ?? "";
    if (!byArtist.has(key)) byArtist.set(key, []);
    byArtist.get(key)!.push(r);
    artistPlays.set(key, r.artistPlays);
  }

  // Artists ordered by total plays desc (biggest lead the interleave).
  const orderedArtists = [...byArtist.keys()].sort(
    (a, b) => (artistPlays.get(b) ?? 0) - (artistPlays.get(a) ?? 0),
  );

  const tracks: CandidateTrack[] = [];
  for (const key of orderedArtists) {
    const candidates = byArtist.get(key)!;
    // Earliest first-play = "old", latest first-play = "new".
    let old = candidates[0];
    let recent = candidates[0];
    for (const c of candidates) {
      if (c.firstPlayed < old.firstPlayed) old = c;
      if (c.firstPlayed > recent.firstPlayed) recent = c;
    }

    tracks.push({
      uri: old.uri,
      artist: old.artist,
      track: old.track,
      album: old.album,
      score: old.artistPlays,
      reason: `earliest ${old.artist ?? "?"} track you kept — first played ${monthYearLabel(old.firstPlayed)}`,
    });
    // Same uri (artist effectively has one qualifying track) → include once.
    if (recent.uri !== old.uri) {
      tracks.push({
        uri: recent.uri,
        artist: recent.artist,
        track: recent.track,
        album: recent.album,
        score: recent.artistPlays,
        reason: `newest ${recent.artist ?? "?"} track you took to — first played ${monthYearLabel(recent.firstPlayed)}`,
      });
    }
  }

  return [
    {
      name: "Old & new",
      description:
        `For my favourite artists (${minArtistPlays}+ plays across ${minArtistYears}+ years), ` +
        `the track I discovered earliest paired with the one I found most recently — ` +
        `my taste in each artist across time.`,
      recipeKey: "oldAndNew",
      params: { ...params },
      tracks: tracks.slice(0, size),
    },
  ];
}

export const OLD_AND_NEW: Recipe<OldAndNewParams> = {
  key: "oldAndNew",
  label: "Old & new",
  description:
    "For my favourite artists, the track I discovered earliest paired with the " +
    "one I found most recently — my taste in each artist across time.",
  defaultParams: OLD_AND_NEW_DEFAULTS,
  generate: generateOldAndNew,
};

export interface GatewaySongsParams {
  /** Min total meaningful plays for an artist to count as a "favourite". */
  minArtistPlays: number;
  /** Only consider the top N favourite artists by total meaningful plays. */
  artists: number;
  /** Max tracks in the generated playlist. */
  size: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const GATEWAY_SONGS_DEFAULTS: GatewaySongsParams = {
  minArtistPlays: 80,
  artists: 40,
  size: 40,
};

/** One artist's gateway track (their first-ever played) from the aggregate. */
interface GatewayRow {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  gatewayPlayed: string; // the artist's earliest single meaningful played_at
  artistPlays: number; // artist's total meaningful plays
}

/**
 * Gateway songs: the very first track I ever played by each artist who went on
 * to become a favourite — the song that started it.
 *
 * Favourite artists clear `minArtistPlays` total meaningful plays; only the top
 * `artists` by that total are considered. For each, the gateway track is the
 * uri carrying the artist's earliest single meaningful `played_at` (the first
 * thing I actually played by them), tie-broken by that play's timestamp then by
 * the uri's plays desc. One track per artist, ordered by the gateway date
 * ascending — a chronological tour of how my favourites entered my life —
 * capped at `size`. `score` is the artist's total plays. Names are chosen per
 * uri in SQL. UTC, meaningful plays only.
 */
function generateGatewaySongs(params: GatewaySongsParams): GeneratedPlaylist[] {
  const { minArtistPlays, artists, size } = params;

  // Per favourite artist, the uri whose earliest meaningful play is the
  // earliest of any of the artist's tracks. We rank each uri's first-play time
  // within the artist and keep rank 1; ties break by plays desc.
  const rows = db()
    .prepare(
      `WITH plays AS (
         SELECT spotify_track_uri AS uri,
                artist_name,
                track_name,
                album_name,
                played_at
         FROM music_listening_events
         WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
           AND artist_name IS NOT NULL
       ),
       artist_totals AS (
         SELECT artist_name, COUNT(*) AS artistPlays
         FROM plays
         GROUP BY artist_name
         HAVING COUNT(*) >= ?
         ORDER BY artistPlays DESC
         LIMIT ?
       ),
       uri_agg AS (
         SELECT p.uri,
                p.artist_name,
                COUNT(*)         AS plays,
                MIN(p.played_at) AS firstPlayed
         FROM plays p
         JOIN artist_totals a ON a.artist_name = p.artist_name
         GROUP BY p.uri
       ),
       ranked AS (
         SELECT uri,
                artist_name,
                firstPlayed,
                ROW_NUMBER() OVER (
                  PARTITION BY artist_name
                  ORDER BY firstPlayed, plays DESC, uri
                ) AS rank
         FROM uri_agg
       ),
       names AS (
         SELECT uri, artist_name, track_name, album_name,
                ROW_NUMBER() OVER (
                  PARTITION BY uri
                  ORDER BY COUNT(*) DESC, MAX(played_at) DESC
                ) AS rn
         FROM plays
         GROUP BY uri, artist_name, track_name, album_name
       )
       SELECT ranked.uri          AS uri,
              names.artist_name   AS artist,
              names.track_name    AS track,
              names.album_name    AS album,
              ranked.firstPlayed  AS gatewayPlayed,
              artist_totals.artistPlays AS artistPlays
       FROM ranked
       JOIN names ON names.uri = ranked.uri AND names.rn = 1
       JOIN artist_totals ON artist_totals.artist_name = ranked.artist_name
       WHERE ranked.rank = 1
       ORDER BY ranked.firstPlayed`,
    )
    .all(minArtistPlays, artists) as GatewayRow[];

  const tracks: CandidateTrack[] = rows.slice(0, size).map((r) => ({
    uri: r.uri,
    artist: r.artist,
    track: r.track,
    album: r.album,
    score: r.artistPlays,
    reason: `the first ${r.artist ?? "?"} song you played — ${monthYearLabel(r.gatewayPlayed)}`,
  }));

  return [
    {
      name: "Gateway songs",
      description:
        `The very first track I ever played by each of my favourite artists ` +
        `(${minArtistPlays}+ plays) — the song that started it, in the order ` +
        `they entered my life.`,
      recipeKey: "gatewaySongs",
      params: { ...params },
      tracks,
    },
  ];
}

export const GATEWAY_SONGS: Recipe<GatewaySongsParams> = {
  key: "gatewaySongs",
  label: "Gateway songs",
  description:
    "The first track I ever played by each artist who went on to become a " +
    "favourite — the song that started it.",
  defaultParams: GATEWAY_SONGS_DEFAULTS,
  generate: generateGatewaySongs,
};

/** The four UTC seasons, in display order. */
type Season = "winter" | "spring" | "summer" | "autumn";
const SEASONS: Season[] = ["winter", "spring", "summer", "autumn"];
const SEASON_LABEL: Record<Season, string> = {
  winter: "Winter",
  spring: "Spring",
  summer: "Summer",
  autumn: "Autumn",
};

/** Season of a UTC month index (0=Jan..11=Dec): Dec/Jan/Feb winter, etc. */
function seasonOfMonth(month: number): Season {
  if (month === 11 || month === 0 || month === 1) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  return "autumn";
}

export interface SeasonalParams {
  /** Min lifetime meaningful plays for a track to qualify for any season. */
  minPlays: number;
  /** Min share (0..1) of a track's plays that must fall in one season. */
  concentration: number;
  /** Max tracks per generated (per-season) playlist. */
  size: number;
  /** Max tracks from any one artist per playlist. */
  perArtistCap: number;
  /** If set, only generate the playlist for this season. */
  season?: Season;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const SEASONAL_DEFAULTS: SeasonalParams = {
  minPlays: 8,
  concentration: 0.5,
  size: 40,
  perArtistCap: 3,
};

interface SeasonalQualifier {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  season: Season;
  seasonPlays: number;
  plays: number;
  seasonShare: number;
  score: number;
}

/**
 * Seasonal fingerprints: tracks I play disproportionately in one season across
 * all years — my summer songs, my winter songs.
 *
 * From one ordered scan of meaningful plays we count, per track (by
 * `spotify_track_uri`), how many plays fall in each UTC season (winter =
 * Dec/Jan/Feb, spring = Mar/Apr/May, summer = Jun/Jul/Aug, autumn =
 * Sep/Oct/Nov) and its lifetime total. A track qualifies for its single
 * highest-share season when it cleared `minPlays` total AND that season's share
 * is at least `concentration`. Qualifiers are bucketed into that one dominant
 * season, ranked by `seasonShare * plays` desc within each (with a per-artist
 * cap) and capped at `size`, returned as one playlist per season (or only
 * `season` if the param is set). UTC throughout.
 */
function generateSeasonal(params: SeasonalParams): GeneratedPlaylist[] {
  const { minPlays, concentration, size, perArtistCap, season } = params;

  const rows = db()
    .prepare(
      `SELECT spotify_track_uri AS uri,
              played_at,
              artist_name,
              track_name,
              album_name
       FROM music_listening_events
       WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
       ORDER BY spotify_track_uri, played_at`,
    )
    .all() as PlayRow[];

  const qualifiers: SeasonalQualifier[] = [];

  let start = 0;
  while (start < rows.length) {
    let end = start;
    const uri = rows[start].uri;
    while (end < rows.length && rows[end].uri === uri) end++;
    const group = rows.slice(start, end);
    start = end;

    const plays = group.length;
    if (plays < minPlays) continue;

    const bySeason = new Map<Season, number>();
    for (const r of group) {
      const s = seasonOfMonth(new Date(r.played_at).getUTCMonth());
      bySeason.set(s, (bySeason.get(s) ?? 0) + 1);
    }

    // The track's single highest-share (dominant) season.
    let bestSeason: Season = "winter";
    let bestPlays = 0;
    for (const s of SEASONS) {
      const n = bySeason.get(s) ?? 0;
      if (n > bestPlays) {
        bestPlays = n;
        bestSeason = s;
      }
    }
    const seasonShare = bestPlays / plays;
    if (seasonShare < concentration) continue;

    const display = pickDisplay(group);
    qualifiers.push({
      uri,
      artist: display.artist,
      track: display.track,
      album: display.album,
      season: bestSeason,
      seasonPlays: bestPlays,
      plays,
      seasonShare,
      score: seasonShare * plays,
    });
  }

  const targetSeasons = season ? [season] : SEASONS;
  const playlists: GeneratedPlaylist[] = [];

  for (const s of targetSeasons) {
    const candidates = qualifiers
      .filter((q) => q.season === s)
      .sort((a, b) => b.score - a.score);
    if (candidates.length === 0) continue;

    const perArtist = new Map<string, number>();
    const picked: CandidateTrack[] = [];
    for (const q of candidates) {
      if (picked.length >= size) break;
      const artistKey = q.artist ?? "";
      const used = perArtist.get(artistKey) ?? 0;
      if (used >= perArtistCap) continue;
      perArtist.set(artistKey, used + 1);
      picked.push({
        uri: q.uri,
        artist: q.artist,
        track: q.track,
        album: q.album,
        score: q.score,
        reason: `${Math.round(q.seasonShare * 100)}% of plays in ${s} (${q.seasonPlays} of ${q.plays})`,
      });
    }

    playlists.push({
      name: `${SEASON_LABEL[s]} songs`,
      description:
        `Tracks I play disproportionately in ${s} — ${minPlays}+ lifetime plays ` +
        `with ${Math.round(concentration * 100)}%+ of them falling in ${s}.`,
      recipeKey: "seasonal",
      params: { ...params, season: s },
      tracks: picked,
    });
  }

  return playlists;
}

export const SEASONAL: Recipe<SeasonalParams> = {
  key: "seasonal",
  label: "Seasonal fingerprints",
  description:
    "Tracks I play disproportionately in one season across all years — my " +
    "summer songs, my winter songs.",
  defaultParams: SEASONAL_DEFAULTS,
  generate: generateSeasonal,
};

export interface FaithfulFavouritesParams {
  /** Min distinct UTC calendar years the track must have been played in. */
  minYears: number;
  /** Min lifetime meaningful plays. */
  minPlays: number;
  /** Max tracks in the generated playlist. */
  size: number;
  /** Max tracks from any one artist. */
  perArtistCap: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const FAITHFUL_FAVOURITES_DEFAULTS: FaithfulFavouritesParams = {
  minYears: 5,
  minPlays: 15,
  size: 50,
  perArtistCap: 3,
};

interface FaithfulQualifier extends CandidateTrack {
  artistKey: string;
}

/**
 * Faithful favourites: tracks played steadily across many calendar years — my
 * evergreens, the inverse of Obsessions and Lapsed loves.
 *
 * From one ordered scan of meaningful plays we collect, per track (by
 * `spotify_track_uri`), its distinct UTC calendar years and lifetime play
 * count. A track qualifies when it spans at least `minYears` distinct years AND
 * cleared `minPlays` total. The score `distinctYears * sqrt(plays)` puts breadth
 * across years first with volume as a secondary boost. Ranked by score desc with
 * a per-artist cap, capped at `size`, as a single playlist. UTC throughout.
 */
function generateFaithfulFavourites(
  params: FaithfulFavouritesParams,
): GeneratedPlaylist[] {
  const { minYears, minPlays, size, perArtistCap } = params;

  const rows = db()
    .prepare(
      `SELECT spotify_track_uri AS uri,
              played_at,
              artist_name,
              track_name,
              album_name
       FROM music_listening_events
       WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
       ORDER BY spotify_track_uri, played_at`,
    )
    .all() as PlayRow[];

  const candidates: FaithfulQualifier[] = [];

  let start = 0;
  while (start < rows.length) {
    let end = start;
    const uri = rows[start].uri;
    while (end < rows.length && rows[end].uri === uri) end++;
    const group = rows.slice(start, end);
    start = end;

    const plays = group.length;
    if (plays < minPlays) continue;

    const years = new Set<number>();
    for (const r of group) years.add(utcYear(r.played_at));
    const distinctYears = years.size;
    if (distinctYears < minYears) continue;

    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const display = pickDisplay(group);
    candidates.push({
      uri,
      artist: display.artist,
      track: display.track,
      album: display.album,
      score: distinctYears * Math.sqrt(plays),
      reason: `played across ${distinctYears} years (${minYear}–${maxYear}) · ${plays} plays`,
      artistKey: display.artist ?? "",
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  const perArtist = new Map<string, number>();
  const picked: CandidateTrack[] = [];
  for (const c of candidates) {
    if (picked.length >= size) break;
    const used = perArtist.get(c.artistKey) ?? 0;
    if (used >= perArtistCap) continue;
    perArtist.set(c.artistKey, used + 1);
    const { artistKey: _artistKey, ...track } = c;
    void _artistKey;
    picked.push(track);
  }

  return [
    {
      name: "Faithful favourites",
      description:
        `Tracks I've played steadily across ${minYears}+ calendar years ` +
        `(${minPlays}+ plays) — my evergreens, the inverse of Obsessions.`,
      recipeKey: "faithfulFavourites",
      params: { ...params },
      tracks: picked,
    },
  ];
}

export const FAITHFUL_FAVOURITES: Recipe<FaithfulFavouritesParams> = {
  key: "faithfulFavourites",
  label: "Faithful favourites",
  description:
    "Tracks I've played steadily across many calendar years — my evergreens, " +
    "the inverse of Obsessions and Lapsed loves.",
  defaultParams: FAITHFUL_FAVOURITES_DEFAULTS,
  generate: generateFaithfulFavourites,
};

export interface SleeperHitsParams {
  /** Min lifetime meaningful plays for a track to be considered. */
  minPlays: number;
  /** Min months between first play and the start of the peak 30-day window. */
  minGapMonths: number;
  /** Max tracks in the generated playlist. */
  size: number;
  /** Max tracks from any one artist. */
  perArtistCap: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const SLEEPER_HITS_DEFAULTS: SleeperHitsParams = {
  minPlays: 10,
  minGapMonths: 12,
  size: 40,
  perArtistCap: 3,
};

interface SleeperQualifier {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  firstIso: string;
  peakStartIso: string;
  gapMonths: number;
  peakWindowPlays: number;
  score: number;
}

/**
 * Sleeper hits: slow burns — a long gap between when I first played a track and
 * when it finally took over.
 *
 * Reusing the ordered-scan + `peakWindow(...)` approach from Obsessions, for
 * each track (by `spotify_track_uri`) clearing `minPlays` meaningful plays we
 * take its earliest play and the start of its densest 30-day window. The gap
 * (in whole-ish months, never negative) is how long it sat before taking off;
 * a track qualifies when that gap is at least `minGapMonths`. Scored by
 * `gapMonths * peakWindowPlays` (longer slow-burns that then peaked hard lead),
 * ranked desc with a per-artist cap, capped at `size`, as a single playlist.
 * UTC throughout.
 */
function generateSleeperHits(params: SleeperHitsParams): GeneratedPlaylist[] {
  const { minPlays, minGapMonths, size, perArtistCap } = params;

  const rows = db()
    .prepare(
      `SELECT spotify_track_uri AS uri,
              played_at,
              artist_name,
              track_name,
              album_name
       FROM music_listening_events
       WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
       ORDER BY spotify_track_uri, played_at`,
    )
    .all() as PlayRow[];

  const qualifiers: SleeperQualifier[] = [];

  let start = 0;
  while (start < rows.length) {
    let end = start;
    const uri = rows[start].uri;
    while (end < rows.length && rows[end].uri === uri) end++;
    const group = rows.slice(start, end);
    start = end;

    if (group.length < minPlays) continue;

    const isos = group.map((r) => r.played_at);
    const times = isos.map((s) => new Date(s).getTime());
    const firstMs = times[0]; // sorted ascending
    const peak = peakWindow(times, isos);
    const peakStartMs = new Date(peak.startIso).getTime();

    const gapMonths = Math.max(0, (peakStartMs - firstMs) / (30 * DAY_MS));
    if (gapMonths < minGapMonths) continue;

    const display = pickDisplay(group);
    qualifiers.push({
      uri,
      artist: display.artist,
      track: display.track,
      album: display.album,
      firstIso: isos[0],
      peakStartIso: peak.startIso,
      gapMonths,
      peakWindowPlays: peak.peakWindowPlays,
      score: gapMonths * peak.peakWindowPlays,
    });
  }

  qualifiers.sort((a, b) => b.score - a.score);

  const perArtist = new Map<string, number>();
  const picked: CandidateTrack[] = [];
  for (const q of qualifiers) {
    if (picked.length >= size) break;
    const artistKey = q.artist ?? "";
    const used = perArtist.get(artistKey) ?? 0;
    if (used >= perArtistCap) continue;
    perArtist.set(artistKey, used + 1);
    picked.push({
      uri: q.uri,
      artist: q.artist,
      track: q.track,
      album: q.album,
      score: q.score,
      reason: `first heard ${monthYearLabel(q.firstIso)}, took off ${monthYearLabel(q.peakStartIso)} — ${Math.round(q.gapMonths)} months later`,
    });
  }

  return [
    {
      name: "Sleeper hits",
      description:
        `Slow burns — tracks (${minPlays}+ plays) where ${minGapMonths}+ months ` +
        `passed between the first play and the peak listening stretch.`,
      recipeKey: "sleeperHits",
      params: { ...params },
      tracks: picked,
    },
  ];
}

export const SLEEPER_HITS: Recipe<SleeperHitsParams> = {
  key: "sleeperHits",
  label: "Sleeper hits",
  description:
    "Slow burns — a long gap between when I first played a track and when it " +
    "finally took over.",
  defaultParams: SLEEPER_HITS_DEFAULTS,
  generate: generateSleeperHits,
};

export interface ComebackKidsParams {
  /** Min lifetime meaningful plays for a track to be considered. */
  minPlays: number;
  /** A gap longer than this (in ~30.44-day months) starts a new cluster. */
  gapMonths: number;
  /** Min plays a cluster needs to count as a real listening stretch. */
  minClusterPlays: number;
  /** Min qualifying clusters the track needs (distinct revivals). */
  minClusters: number;
  /** Max tracks in the generated playlist. */
  size: number;
  /** Max tracks from any one artist. */
  perArtistCap: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const COMEBACK_KIDS_DEFAULTS: ComebackKidsParams = {
  minPlays: 12,
  gapMonths: 6,
  minClusterPlays: 4,
  minClusters: 2,
  size: 40,
  perArtistCap: 3,
};

interface ComebackQualifier {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  clusterYears: number[]; // UTC year of each qualifying cluster's first play
  clusterCount: number; // number of qualifying clusters
  plays: number; // lifetime meaningful plays
  score: number;
}

/**
 * Comeback kids: tracks that died, then I revived them — multiple distinct
 * listening stretches separated by long silences.
 *
 * Reusing the ordered-scan + consecutive-by-uri grouping from Obsessions, for
 * each track (by `spotify_track_uri`) clearing `minPlays` meaningful plays we
 * walk its sorted plays and split them into **clusters**, starting a new
 * cluster whenever the gap to the previous play exceeds `gapMonths` (converted
 * to ms via ~30.44-day months). Clusters with at least `minClusterPlays` plays
 * count as real listening stretches; the track qualifies when it has at least
 * `minClusters` such stretches. Scored by `qualifyingClusters * plays` (more
 * revivals and more total play lead), ranked desc with a per-artist cap, capped
 * at `size`, as a single playlist. UTC throughout.
 */
function generateComebackKids(params: ComebackKidsParams): GeneratedPlaylist[] {
  const { minPlays, gapMonths, minClusterPlays, minClusters, size, perArtistCap } =
    params;

  // ~30.44-day months → ms, for splitting plays into time-separated clusters.
  const gapMs = gapMonths * 30.44 * DAY_MS;

  const rows = db()
    .prepare(
      `SELECT spotify_track_uri AS uri,
              played_at,
              artist_name,
              track_name,
              album_name
       FROM music_listening_events
       WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
       ORDER BY spotify_track_uri, played_at`,
    )
    .all() as PlayRow[];

  const qualifiers: ComebackQualifier[] = [];

  let start = 0;
  while (start < rows.length) {
    let end = start;
    const uri = rows[start].uri;
    while (end < rows.length && rows[end].uri === uri) end++;
    const group = rows.slice(start, end);
    start = end;

    if (group.length < minPlays) continue;

    const times = group.map((r) => new Date(r.played_at).getTime());

    // Split the sorted plays into clusters; a gap > gapMs starts a new one.
    // Track each cluster's play count and its first play's ISO timestamp.
    const clusterCounts: number[] = [];
    const clusterFirstIso: string[] = [];
    let curCount = 0;
    let curFirstIso = "";
    for (let i = 0; i < group.length; i++) {
      if (i === 0 || times[i] - times[i - 1] > gapMs) {
        if (curCount > 0) {
          clusterCounts.push(curCount);
          clusterFirstIso.push(curFirstIso);
        }
        curCount = 0;
        curFirstIso = group[i].played_at;
      }
      curCount++;
    }
    if (curCount > 0) {
      clusterCounts.push(curCount);
      clusterFirstIso.push(curFirstIso);
    }

    // Keep only clusters that are real listening stretches.
    const clusterYears: number[] = [];
    for (let i = 0; i < clusterCounts.length; i++) {
      if (clusterCounts[i] >= minClusterPlays) {
        clusterYears.push(utcYear(clusterFirstIso[i]));
      }
    }
    if (clusterYears.length < minClusters) continue;

    const display = pickDisplay(group);
    qualifiers.push({
      uri,
      artist: display.artist,
      track: display.track,
      album: display.album,
      clusterYears,
      clusterCount: clusterYears.length,
      plays: group.length,
      score: clusterYears.length * group.length,
    });
  }

  qualifiers.sort((a, b) => b.score - a.score);

  const perArtist = new Map<string, number>();
  const picked: CandidateTrack[] = [];
  for (const q of qualifiers) {
    if (picked.length >= size) break;
    const artistKey = q.artist ?? "";
    const used = perArtist.get(artistKey) ?? 0;
    if (used >= perArtistCap) continue;
    perArtist.set(artistKey, used + 1);

    // List each stretch's year; collapse to first–last when there are many.
    const years = q.clusterYears;
    const yearList =
      years.length <= 3
        ? years.join(", ")
        : `${years[0]}–${years[years.length - 1]}`;
    const reason =
      years.length <= 3
        ? `played in ${q.clusterCount} stretches: ${yearList}`
        : `${q.clusterCount} stretches, ${yearList}`;

    picked.push({
      uri: q.uri,
      artist: q.artist,
      track: q.track,
      album: q.album,
      score: q.score,
      reason,
    });
  }

  return [
    {
      name: "Comeback kids",
      description:
        `Tracks I played (${minPlays}+ times), set aside, then came back to — ` +
        `${minClusters}+ separate listening stretches of ${minClusterPlays}+ plays, ` +
        `split by ${gapMonths}+ month silences.`,
      recipeKey: "comebackKids",
      params: { ...params },
      tracks: picked,
    },
  ];
}

export const COMEBACK_KIDS: Recipe<ComebackKidsParams> = {
  key: "comebackKids",
  label: "Comeback kids",
  description:
    "Tracks that died, then I revived them — multiple distinct listening " +
    "stretches separated by long silences.",
  defaultParams: COMEBACK_KIDS_DEFAULTS,
  generate: generateComebackKids,
};

export interface TimeCapsuleParams {
  /** Half-width (in days) of the day-of-year window around today. */
  windowDays: number;
  /** Min in-window plays (across past years) for a track to qualify. */
  minPlaysInWindow: number;
  /** Max tracks in the generated playlist. */
  size: number;
  /** Max tracks from any one artist. */
  perArtistCap: number;
  // Index signature so params satisfy Record<string, unknown> (registry type).
  [key: string]: unknown;
}

const TIME_CAPSULE_DEFAULTS: TimeCapsuleParams = {
  windowDays: 10,
  minPlaysInWindow: 4,
  size: 40,
  perArtistCap: 3,
};

interface TimeCapsuleQualifier {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  windowPlays: number; // in-window plays across past years
  years: number[]; // distinct past years with an in-window play
  score: number;
}

/** Day-of-year (1..366) of an ISO timestamp, in UTC. */
function utcDayOfYear(iso: string): number {
  const d = new Date(iso);
  const startOfYear = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - startOfYear) / DAY_MS) + 1;
}

/**
 * Time capsule: what I was playing THIS time of year in years past —
 * today-relative nostalgia.
 *
 * NOTE: this recipe is date-relative — its output changes with today's date
 * (`new Date()`, UTC). That's intended: it surfaces tracks tied to the current
 * calendar week across previous years.
 *
 * From one ordered scan of meaningful plays, for each play in a year strictly
 * before the current year we test whether its day-of-year is within
 * `windowDays` of today's, using the min of the direct and wrapped (365 − d)
 * distances so the window straddles the Dec→Jan boundary. Per track (by
 * `spotify_track_uri`) we count such in-window plays and collect the distinct
 * past years they fell in. A track qualifies when its in-window plays reach
 * `minPlaysInWindow`. Scored by in-window plays, ranked desc with a per-artist
 * cap, capped at `size`, as a single playlist. UTC throughout.
 */
function generateTimeCapsule(params: TimeCapsuleParams): GeneratedPlaylist[] {
  const { windowDays, minPlaysInWindow, size, perArtistCap } = params;

  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const todayDoy = utcDayOfYear(today.toISOString());
  const todayLabel = today.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });

  const rows = db()
    .prepare(
      `SELECT spotify_track_uri AS uri,
              played_at,
              artist_name,
              track_name,
              album_name
       FROM music_listening_events
       WHERE ms_played >= 30000 AND spotify_track_uri IS NOT NULL
       ORDER BY spotify_track_uri, played_at`,
    )
    .all() as PlayRow[];

  const qualifiers: TimeCapsuleQualifier[] = [];

  let start = 0;
  while (start < rows.length) {
    let end = start;
    const uri = rows[start].uri;
    while (end < rows.length && rows[end].uri === uri) end++;
    const group = rows.slice(start, end);
    start = end;

    let windowPlays = 0;
    const years = new Set<number>();
    for (const r of group) {
      const y = utcYear(r.played_at);
      if (y >= currentYear) continue; // only years strictly before this one
      const doy = utcDayOfYear(r.played_at);
      const direct = Math.abs(doy - todayDoy);
      const dist = Math.min(direct, 365 - direct); // wrap across Dec→Jan
      if (dist <= windowDays) {
        windowPlays++;
        years.add(y);
      }
    }

    if (windowPlays < minPlaysInWindow) continue;

    const display = pickDisplay(group);
    qualifiers.push({
      uri,
      artist: display.artist,
      track: display.track,
      album: display.album,
      windowPlays,
      years: [...years].sort((a, b) => a - b),
      score: windowPlays,
    });
  }

  qualifiers.sort((a, b) => b.score - a.score);

  const perArtist = new Map<string, number>();
  const picked: CandidateTrack[] = [];
  for (const q of qualifiers) {
    if (picked.length >= size) break;
    const artistKey = q.artist ?? "";
    const used = perArtist.get(artistKey) ?? 0;
    if (used >= perArtistCap) continue;
    perArtist.set(artistKey, used + 1);
    picked.push({
      uri: q.uri,
      artist: q.artist,
      track: q.track,
      album: q.album,
      score: q.score,
      reason: `you played this around mid-${todayLabel} in ${q.years.join(", ")}`,
    });
  }

  return [
    {
      name: "Time capsule: this week, years past",
      description:
        `What I was playing around this time of year (±${windowDays} days) in ` +
        `years past — tracks with ${minPlaysInWindow}+ plays in that window ` +
        `across previous years. Changes day to day.`,
      recipeKey: "timeCapsule",
      params: { ...params },
      tracks: picked,
    },
  ];
}

export const TIME_CAPSULE: Recipe<TimeCapsuleParams> = {
  key: "timeCapsule",
  label: "Time capsule: this week, years past",
  description:
    "What I was playing this same time of year in years past — " +
    "today-relative nostalgia (its output changes day to day).",
  defaultParams: TIME_CAPSULE_DEFAULTS,
  generate: generateTimeCapsule,
};

/**
 * Recipe registry. Keyed by `recipeKey` so generated playlists can be traced
 * back to the recipe that built them (provenance lives in playlist_tracks per
 * 8A.1).
 */
export const RECIPES: Record<string, Recipe> = {
  [OBSESSIONS.key]: OBSESSIONS,
  [LAPSED_LOVES.key]: LAPSED_LOVES,
  [DEEP_CUTS.key]: DEEP_CUTS,
  [ONE_HIT_OBSESSIONS.key]: ONE_HIT_OBSESSIONS,
  [OLD_AND_NEW.key]: OLD_AND_NEW,
  [GATEWAY_SONGS.key]: GATEWAY_SONGS,
  [SEASONAL.key]: SEASONAL,
  [FAITHFUL_FAVOURITES.key]: FAITHFUL_FAVOURITES,
  [SLEEPER_HITS.key]: SLEEPER_HITS,
  [COMEBACK_KIDS.key]: COMEBACK_KIDS,
  [TIME_CAPSULE.key]: TIME_CAPSULE,
};
