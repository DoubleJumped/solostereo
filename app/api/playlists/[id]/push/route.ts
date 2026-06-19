import { NextResponse } from "next/server";
import {
  getIncludedTracks,
  getPlaylist,
  markPushed,
} from "@/lib/playlists";
import {
  createSpotifyPlaylist,
  getAccount,
  getSpotifyConfig,
  hasPlaylistScopes,
  replacePlaylistTracks,
  updatePlaylistDetails,
} from "@/lib/spotify";

/**
 * Push a finished playlist to the owner's real Spotify account (task 8C.3).
 *
 * POST — creates (or, if already pushed, UPDATES) a Spotify playlist from the
 * playlist's INCLUDED tracks in position order.
 *
 * Status-code contract the editor UI depends on:
 *  - 400 `{ error: "Invalid playlist id." }`        — bad id
 *  - 404 `{ error: "Playlist not found." }`         — no such playlist
 *  - 400 `{ error: "No included tracks to push." }` — nothing to push
 *  - 400 `{ error: "not_configured" }`              — missing credentials
 *  - 409 `{ error: "not_connected" }`               — no Spotify account
 *  - 409 `{ error: "reconnect", message: … }`       — account lacks playlist scopes
 *  - 200 `{ spotifyPlaylistId, url, snapshotId, updated }` — success
 *
 * Re-push guard: if the playlist already carries a `spotifyPlaylistId`, the
 * existing Spotify playlist is updated in place (details + full track replace)
 * rather than creating a duplicate (`updated: true`). Otherwise a new playlist
 * is created and filled (`updated: false`).
 *
 * `params` is a promise in this Next.js version and must be awaited.
 */

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await params).id);
    if (id === null) {
      return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
    }

    const playlist = getPlaylist(id);
    if (!playlist) {
      return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
    }

    const tracks = getIncludedTracks(id);
    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No included tracks to push." },
        { status: 400 },
      );
    }

    if (getSpotifyConfig() === null) {
      return NextResponse.json({ error: "not_configured" }, { status: 400 });
    }
    const account = getAccount();
    if (!account) {
      return NextResponse.json({ error: "not_connected" }, { status: 409 });
    }
    if (!hasPlaylistScopes(account)) {
      return NextResponse.json(
        {
          error: "reconnect",
          message: "Reconnect Spotify to grant playlist permissions.",
        },
        { status: 409 },
      );
    }

    const uris = tracks.map((t) => t.uri);
    const description = playlist.description ?? "";

    let spotifyPlaylistId: string;
    let updated: boolean;

    if (playlist.spotifyPlaylistId) {
      // Re-push: update the existing Spotify playlist in place.
      spotifyPlaylistId = playlist.spotifyPlaylistId;
      await updatePlaylistDetails(
        spotifyPlaylistId,
        playlist.name,
        description,
        playlist.public,
      );
      updated = true;
    } else {
      // First push: create a new playlist, then fill it.
      const created = await createSpotifyPlaylist(
        playlist.name,
        description,
        playlist.public,
      );
      spotifyPlaylistId = created.id;
      updated = false;
    }

    const { snapshotId } = await replacePlaylistTracks(spotifyPlaylistId, uris);
    markPushed(id, spotifyPlaylistId, snapshotId);

    return NextResponse.json({
      spotifyPlaylistId,
      url: `https://open.spotify.com/playlist/${spotifyPlaylistId}`,
      snapshotId,
      updated,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
