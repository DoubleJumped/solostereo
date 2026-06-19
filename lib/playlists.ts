import type Database from "better-sqlite3";
import { openDb } from "./db";
import { RECIPES, type GeneratedPlaylist } from "./recipes";

/**
 * Playlist persistence / CRUD layer (task 8A.4): stores generated and
 * hand-edited playlists in the `playlists` + `playlist_tracks` tables
 * (db/migrations/005_playlists.sql) and round-trips them back out.
 *
 * Unlike lib/queries.ts and lib/recipes.ts (which cache a `query_only`
 * connection), this module needs to WRITE, so it caches its own plain
 * `openDb()` connection. `PRAGMA foreign_keys` is ON from openDb(), so the
 * `playlist_tracks` FK and ON DELETE CASCADE are enforced.
 *
 * All timestamps are ISO 8601 (UTC, via `new Date().toISOString()`).
 * Mutations bump `playlists.updated_at`; multi-row writes run in a transaction.
 */

let _db: Database.Database | null = null;
function db(): Database.Database {
  if (!_db) {
    _db = openDb();
  }
  return _db;
}

/** Current ISO 8601 timestamp. */
function now(): string {
  return new Date().toISOString();
}

/** A playlist with its track counts, for list views. */
export interface PlaylistSummary {
  id: number;
  name: string;
  description: string | null;
  recipeKey: string | null;
  status: string;
  public: boolean;
  trackCount: number;
  includedCount: number;
  createdAt: string;
  updatedAt: string;
  spotifyPlaylistId: string | null;
}

/** A full `playlists` row, camelCased. */
export interface PlaylistRow {
  id: number;
  name: string;
  description: string | null;
  recipeKey: string | null;
  paramsJson: string | null;
  status: string;
  public: boolean;
  spotifyPlaylistId: string | null;
  spotifySnapshotId: string | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
}

/** A `playlist_tracks` row, camelCased. */
export interface PlaylistTrackRow {
  id: number;
  playlistId: number;
  position: number;
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  reason: string | null;
  score: number | null;
  included: boolean;
  addedManually: boolean;
}

/** A track from the local listening catalogue, for manual-add search. */
export interface LocalTrack {
  uri: string;
  artist: string | null;
  track: string | null;
  album: string | null;
  plays: number;
}

/**
 * Preview a recipe without persisting: look up `RECIPES[recipeKey]`, merge
 * `params` over its `defaultParams`, and return the generated playlists.
 * Throws on an unknown recipe key.
 */
export function previewRecipe(
  recipeKey: string,
  params: Record<string, unknown> = {},
): GeneratedPlaylist[] {
  const recipe = RECIPES[recipeKey];
  if (!recipe) {
    throw new Error(
      `Unknown recipe "${recipeKey}". Available: ${Object.keys(RECIPES).join(", ")}`,
    );
  }
  return recipe.generate({ ...recipe.defaultParams, ...params });
}

/**
 * Persist a generated playlist as a draft and its tracks (in one transaction).
 * The new playlist is status 'draft', public, with `recipe_key`/`params_json`
 * from the recipe. Tracks keep their recipe provenance (reason/score) at
 * positions 0..n-1, all included and not manually added. Returns the new id.
 */
export function createDraft(gp: GeneratedPlaylist): number {
  const ts = now();
  const insertPlaylist = db().prepare(
    `INSERT INTO playlists
       (name, description, recipe_key, params_json, status, public, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)`,
  );
  const insertTrack = db().prepare(
    `INSERT INTO playlist_tracks
       (playlist_id, position, spotify_track_uri, artist_name, track_name,
        album_name, reason, score, included, added_manually)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
  );

  const tx = db().transaction((): number => {
    const info = insertPlaylist.run(
      gp.name,
      gp.description,
      gp.recipeKey,
      JSON.stringify(gp.params),
      ts,
      ts,
    );
    const playlistId = Number(info.lastInsertRowid);
    gp.tracks.forEach((t, position) => {
      insertTrack.run(
        playlistId,
        position,
        t.uri,
        t.artist,
        t.track,
        t.album,
        t.reason,
        t.score,
      );
    });
    return playlistId;
  });

  return tx();
}

/** All playlists, newest first, with track + included counts. */
export function listPlaylists(): PlaylistSummary[] {
  const rows = db()
    .prepare(
      `SELECT p.id                                       AS id,
              p.name                                     AS name,
              p.description                              AS description,
              p.recipe_key                               AS recipeKey,
              p.status                                   AS status,
              p.public                                   AS public,
              p.created_at                               AS createdAt,
              p.updated_at                               AS updatedAt,
              p.spotify_playlist_id                      AS spotifyPlaylistId,
              COUNT(t.id)                                AS trackCount,
              COALESCE(SUM(t.included), 0)               AS includedCount
       FROM playlists p
       LEFT JOIN playlist_tracks t ON t.playlist_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC, p.id DESC`,
    )
    .all() as (Omit<PlaylistSummary, "public"> & { public: number })[];
  return rows.map((r) => ({ ...r, public: !!r.public }));
}

/** One full playlist row, or null if it does not exist. */
export function getPlaylist(id: number): PlaylistRow | null {
  const r = db()
    .prepare(
      `SELECT id                  AS id,
              name                AS name,
              description         AS description,
              recipe_key          AS recipeKey,
              params_json         AS paramsJson,
              status              AS status,
              public              AS public,
              spotify_playlist_id AS spotifyPlaylistId,
              spotify_snapshot_id AS spotifySnapshotId,
              created_at          AS createdAt,
              updated_at          AS updatedAt,
              pushed_at           AS pushedAt
       FROM playlists
       WHERE id = ?`,
    )
    .get(id) as (Omit<PlaylistRow, "public"> & { public: number }) | undefined;
  return r ? { ...r, public: !!r.public } : null;
}

/**
 * A playlist's INCLUDED tracks, ordered by position. This is what a push uses —
 * excluded tracks are skipped entirely.
 */
export function getIncludedTracks(id: number): PlaylistTrackRow[] {
  return getPlaylistTracks(id).filter((t) => t.included);
}

/**
 * Record a successful push to Spotify (task 8C): flips status to 'pushed',
 * stores the Spotify playlist id + snapshot id, and stamps pushed_at /
 * updated_at to now. Used for both first push and re-push.
 */
export function markPushed(
  id: number,
  spotifyPlaylistId: string,
  snapshotId: string | null,
): void {
  const ts = now();
  db()
    .prepare(
      `UPDATE playlists
         SET status = 'pushed',
             spotify_playlist_id = ?,
             spotify_snapshot_id = ?,
             pushed_at = ?,
             updated_at = ?
       WHERE id = ?`,
    )
    .run(spotifyPlaylistId, snapshotId, ts, ts, id);
}

/** A playlist's tracks, ordered by position. */
export function getPlaylistTracks(id: number): PlaylistTrackRow[] {
  const rows = db()
    .prepare(
      `SELECT id                AS id,
              playlist_id       AS playlistId,
              position          AS position,
              spotify_track_uri AS uri,
              artist_name       AS artist,
              track_name        AS track,
              album_name        AS album,
              reason            AS reason,
              score             AS score,
              included          AS included,
              added_manually    AS addedManually
       FROM playlist_tracks
       WHERE playlist_id = ?
       ORDER BY position`,
    )
    .all(id) as (Omit<PlaylistTrackRow, "included" | "addedManually"> & {
    included: number;
    addedManually: number;
  })[];
  return rows.map((r) => ({
    ...r,
    included: !!r.included,
    addedManually: !!r.addedManually,
  }));
}

/** Rename a playlist (and optionally replace its description). */
export function renamePlaylist(
  id: number,
  name: string,
  description?: string,
): void {
  if (description === undefined) {
    db()
      .prepare(`UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?`)
      .run(name, now(), id);
  } else {
    db()
      .prepare(
        `UPDATE playlists SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
      )
      .run(name, description, now(), id);
  }
}

/** Toggle a playlist's public flag. */
export function setPublic(id: number, isPublic: boolean): void {
  db()
    .prepare(`UPDATE playlists SET public = ?, updated_at = ? WHERE id = ?`)
    .run(isPublic ? 1 : 0, now(), id);
}

/** Include or exclude a single track (without deleting it). */
export function setIncluded(trackId: number, included: boolean): void {
  const tx = db().transaction(() => {
    const info = db()
      .prepare(`UPDATE playlist_tracks SET included = ? WHERE id = ?`)
      .run(included ? 1 : 0, trackId);
    if (info.changes > 0) bumpPlaylistForTrack(trackId);
  });
  tx();
}

/** Remove a track from its playlist. */
export function removeTrack(trackId: number): void {
  const tx = db().transaction(() => {
    const playlistId = playlistIdForTrack(trackId);
    const info = db()
      .prepare(`DELETE FROM playlist_tracks WHERE id = ?`)
      .run(trackId);
    if (info.changes > 0 && playlistId !== null) bumpPlaylist(playlistId);
  });
  tx();
}

/**
 * Reassign every track's position from the given order: the track at
 * `orderedTrackIds[i]` gets position `i`. Runs in a transaction and bumps the
 * playlist's `updated_at`.
 */
export function reorderTracks(
  playlistId: number,
  orderedTrackIds: number[],
): void {
  const update = db().prepare(
    `UPDATE playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?`,
  );
  const tx = db().transaction(() => {
    orderedTrackIds.forEach((trackId, position) => {
      update.run(position, trackId, playlistId);
    });
    bumpPlaylist(playlistId);
  });
  tx();
}

/**
 * Append a track to a playlist at the next position, flagged manually added
 * and included. If the uri is already in the playlist (UNIQUE constraint),
 * nothing is inserted and `{ added: false }` is returned. Bumps `updated_at`
 * when a track is actually added.
 */
export function addTrackByUri(
  playlistId: number,
  t: { uri: string; artist?: string; track?: string; album?: string },
): { added: boolean } {
  const tx = db().transaction((): { added: boolean } => {
    const next = db()
      .prepare(
        `SELECT COALESCE(MAX(position) + 1, 0) AS pos
         FROM playlist_tracks WHERE playlist_id = ?`,
      )
      .get(playlistId) as { pos: number };
    const info = db()
      .prepare(
        `INSERT OR IGNORE INTO playlist_tracks
           (playlist_id, position, spotify_track_uri, artist_name, track_name,
            album_name, included, added_manually)
         VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      )
      .run(
        playlistId,
        next.pos,
        t.uri,
        t.artist ?? null,
        t.track ?? null,
        t.album ?? null,
      );
    if (info.changes === 0) return { added: false };
    bumpPlaylist(playlistId);
    return { added: true };
  });
  return tx();
}

/** Delete a playlist; its tracks cascade away via the FK. */
export function deletePlaylist(id: number): void {
  db().prepare(`DELETE FROM playlists WHERE id = ?`).run(id);
}

/**
 * Search the local listening catalogue for tracks matching `query` in track or
 * artist name (case-insensitive). Results are distinct Spotify tracks (grouped
 * by `spotify_track_uri`), with a representative artist/track/album and the
 * track's meaningful-play count, ordered by plays desc. Powers manual-add.
 */
export function searchLocalTracks(query: string, limit = 20): LocalTrack[] {
  const like = `%${query}%`;
  return db()
    .prepare(
      `SELECT spotify_track_uri        AS uri,
              MAX(artist_name)         AS artist,
              MAX(track_name)          AS track,
              MAX(album_name)          AS album,
              SUM(ms_played >= 30000)  AS plays
       FROM music_listening_events
       WHERE spotify_track_uri IS NOT NULL
         AND (track_name LIKE ? OR artist_name LIKE ?)
       GROUP BY spotify_track_uri
       ORDER BY plays DESC
       LIMIT ?`,
    )
    .all(like, like, limit) as LocalTrack[];
}

/** The playlist id a track belongs to, or null if the track is gone. */
function playlistIdForTrack(trackId: number): number | null {
  const r = db()
    .prepare(`SELECT playlist_id AS id FROM playlist_tracks WHERE id = ?`)
    .get(trackId) as { id: number } | undefined;
  return r ? r.id : null;
}

/** Bump a playlist's updated_at to now. */
function bumpPlaylist(playlistId: number): void {
  db()
    .prepare(`UPDATE playlists SET updated_at = ? WHERE id = ?`)
    .run(now(), playlistId);
}

/** Bump the updated_at of the playlist owning the given track. */
function bumpPlaylistForTrack(trackId: number): void {
  const playlistId = playlistIdForTrack(trackId);
  if (playlistId !== null) bumpPlaylist(playlistId);
}
