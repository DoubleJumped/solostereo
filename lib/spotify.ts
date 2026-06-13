import crypto from "node:crypto";
import { openDb } from "./db";
import { dedupHash } from "./dedup";

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const ME_URL = "https://api.spotify.com/v1/me";
const RECENT_URL = "https://api.spotify.com/v1/me/player/recently-played";

/**
 * Only the recently-played scope is required for the sync; email/profile let
 * us confirm and label the connected account.
 */
export const SPOTIFY_SCOPES = "user-read-recently-played user-read-email";

/** Rows synced from the API are tagged with this source filename. */
export const API_SOURCE = "spotify-api";

export interface SpotifyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Returns null when the app has not been given Spotify credentials yet. */
export function getSpotifyConfig(): SpotifyConfig | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri:
      process.env.SPOTIFY_REDIRECT_URI ??
      "http://127.0.0.1:3000/api/spotify/callback",
  };
}

export interface SpotifyAccount {
  account_id: string;
  display_name: string | null;
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  scope: string | null;
  last_synced_at: string | null;
  last_played_at: string | null;
  connected_at: string;
}

export function getAccount(): SpotifyAccount | null {
  const db = openDb();
  const row = db
    .prepare("SELECT * FROM spotify_account WHERE id = 1")
    .get() as SpotifyAccount | undefined;
  db.close();
  return row ?? null;
}

export function disconnectAccount(): void {
  const db = openDb();
  db.prepare("DELETE FROM spotify_account WHERE id = 1").run();
  db.close();
}

export interface SyncStats {
  latest: string | null;
  total: number;
  apiRows: number;
}

export function getSyncStats(): SyncStats {
  const db = openDb();
  const r = db
    .prepare(
      `SELECT MAX(played_at) AS latest,
              COUNT(*) AS total,
              SUM(source_filename = '${API_SOURCE}') AS apiRows
       FROM listening_events`,
    )
    .get() as { latest: string | null; total: number; apiRows: number | null };
  db.close();
  return { latest: r.latest, total: r.total, apiRows: r.apiRows ?? 0 };
}

function basicAuth(cfg: SpotifyConfig): string {
  return (
    "Basic " +
    Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")
  );
}

export function newState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function buildAuthorizeUrl(cfg: SpotifyConfig, state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: cfg.redirectUri,
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

function expiryIso(expiresInSeconds: number): string {
  // 60s safety margin so we refresh before the token actually lapses.
  return new Date(Date.now() + expiresInSeconds * 1000 - 60_000).toISOString();
}

/** Exchange the authorization code for tokens and persist the account. */
export async function exchangeCode(
  cfg: SpotifyConfig,
  code: string,
): Promise<void> {
  const tokRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(cfg),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
    }),
  });
  if (!tokRes.ok) {
    throw new Error(`token exchange failed: ${tokRes.status} ${await tokRes.text()}`);
  }
  const tok = (await tokRes.json()) as TokenResponse;
  if (!tok.refresh_token) {
    throw new Error("Spotify did not return a refresh token");
  }

  const meRes = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!meRes.ok) throw new Error(`profile fetch failed: ${meRes.status}`);
  const me = (await meRes.json()) as { id: string; display_name: string | null };

  const db = openDb();
  db.prepare(
    `INSERT INTO spotify_account
       (id, account_id, display_name, access_token, refresh_token,
        token_expires_at, scope, last_synced_at, last_played_at, connected_at)
     VALUES (1, @account_id, @display_name, @access_token, @refresh_token,
        @token_expires_at, @scope, NULL, NULL, @connected_at)
     ON CONFLICT(id) DO UPDATE SET
       account_id       = excluded.account_id,
       display_name     = excluded.display_name,
       access_token     = excluded.access_token,
       refresh_token    = excluded.refresh_token,
       token_expires_at = excluded.token_expires_at,
       scope            = excluded.scope,
       connected_at     = excluded.connected_at`,
  ).run({
    account_id: me.id,
    display_name: me.display_name,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    token_expires_at: expiryIso(tok.expires_in),
    scope: tok.scope ?? SPOTIFY_SCOPES,
    connected_at: new Date().toISOString(),
  });
  db.close();
}

async function refreshAccessToken(
  cfg: SpotifyConfig,
  account: SpotifyAccount,
): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(cfg),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });
  if (!res.ok) {
    throw new Error(`token refresh failed: ${res.status} ${await res.text()}`);
  }
  const tok = (await res.json()) as TokenResponse;
  const db = openDb();
  // Spotify may or may not return a new refresh token on refresh; keep the old.
  db.prepare(
    `UPDATE spotify_account
       SET access_token = ?, token_expires_at = ?,
           refresh_token = COALESCE(?, refresh_token)
     WHERE id = 1`,
  ).run(tok.access_token, expiryIso(tok.expires_in), tok.refresh_token ?? null);
  db.close();
  return tok.access_token;
}

async function getValidAccessToken(
  cfg: SpotifyConfig,
  account: SpotifyAccount,
): Promise<string> {
  if (Date.parse(account.token_expires_at) > Date.now()) {
    return account.access_token;
  }
  return refreshAccessToken(cfg, account);
}

interface RecentItem {
  track: {
    name: string;
    uri: string;
    duration_ms: number;
    artists: { name: string }[];
    album: { name: string };
  } | null;
  played_at: string;
}

export interface SyncResult {
  fetched: number;
  inserted: number;
  skipped: number;
  newestPlayedAt: string | null;
}

/**
 * Pull the last batch of plays from the API and merge them into
 * listening_events (task 7.2). The Web API exposes only the most recent ~50
 * tracks, so this captures the tail since the last sync. Idempotent via the
 * shared dedup hash; re-running adds nothing.
 *
 * Note: the API does not report how long each track was listened to, so
 * ms_played is set to the track's full duration. Rows are tagged
 * source_filename='spotify-api' so they stay distinguishable from the export.
 */
export async function syncRecentlyPlayed(): Promise<SyncResult> {
  const cfg = getSpotifyConfig();
  if (!cfg) {
    throw new Error(
      "Spotify is not configured — set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
    );
  }
  const account = getAccount();
  if (!account) throw new Error("Spotify is not connected yet.");

  const token = await getValidAccessToken(cfg, account);
  const url = new URL(RECENT_URL);
  url.searchParams.set("limit", "50");
  if (account.last_played_at) {
    url.searchParams.set("after", String(Date.parse(account.last_played_at)));
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`recently-played failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { items?: RecentItem[] };
  const items = data.items ?? [];

  const db = openDb();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO listening_events
       (dedup_hash, played_at, source_filename, track_name, artist_name,
        album_name, spotify_track_uri, ms_played, imported_at)
     VALUES
       (@dedup_hash, @played_at, @source_filename, @track_name, @artist_name,
        @album_name, @spotify_track_uri, @ms_played, @imported_at)`,
  );
  const importedAt = new Date().toISOString();
  let inserted = 0;
  let newest = account.last_played_at;

  const run = db.transaction((rows: RecentItem[]) => {
    for (const it of rows) {
      if (!it.track) continue;
      const artist = it.track.artists?.[0]?.name ?? null;
      const album = it.track.album?.name ?? null;
      const ms = it.track.duration_ms ?? 0;
      const result = insert.run({
        dedup_hash: dedupHash({
          playedAt: it.played_at,
          trackUri: it.track.uri,
          trackName: it.track.name,
          artistName: artist,
          albumName: album,
          msPlayed: ms,
        }),
        played_at: it.played_at,
        source_filename: API_SOURCE,
        track_name: it.track.name,
        artist_name: artist,
        album_name: album,
        spotify_track_uri: it.track.uri,
        ms_played: ms,
        imported_at: importedAt,
      });
      inserted += result.changes;
      if (!newest || it.played_at > newest) newest = it.played_at;
    }
  });
  run(items);

  db.prepare(
    `UPDATE spotify_account
       SET last_synced_at = ?, last_played_at = COALESCE(?, last_played_at)
     WHERE id = 1`,
  ).run(importedAt, newest);
  db.close();

  return {
    fetched: items.length,
    inserted,
    skipped: items.length - inserted,
    newestPlayedAt: newest,
  };
}
