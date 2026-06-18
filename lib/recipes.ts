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
 * went quiet) is registered here; **Lapsed loves** is added in 8A.3.
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

/**
 * Recipe registry. Obsessions is registered now; Lapsed loves is added in
 * 8A.3. Keyed by `recipeKey` so generated playlists can be traced back to the
 * recipe that built them (provenance lives in playlist_tracks per 8A.1).
 */
export const RECIPES: Record<string, Recipe> = {
  [OBSESSIONS.key]: OBSESSIONS,
};
