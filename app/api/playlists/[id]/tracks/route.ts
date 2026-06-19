import { NextResponse } from "next/server";
import { addTrackByUri, getPlaylist, reorderTracks } from "@/lib/playlists";

/**
 * Track-collection mutations for one playlist (tasks 8B.3 / 8B.4).
 *
 *  - POST  body `{ uri, artist?, track?, album? }` — manual-add a track by uri
 *    (8B.4). Returns `{ added: boolean }`; `added:false` when the uri is
 *    already in the playlist.
 *  - PATCH body `{ orderedTrackIds: number[] }` — reorder: reassign positions
 *    from the given id order.
 *
 * `params` is a promise and must be awaited. Bad input → 400 `{ error }`.
 */

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await params).id);
    if (id === null) {
      return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
    }
    if (!getPlaylist(id)) {
      return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
    }

    const body = (await request.json()) as {
      uri?: unknown;
      artist?: unknown;
      track?: unknown;
      album?: unknown;
    };

    if (typeof body.uri !== "string" || body.uri.trim() === "") {
      return NextResponse.json(
        { error: "`uri` must be a non-empty string." },
        { status: 400 },
      );
    }

    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const result = addTrackByUri(id, {
      uri: body.uri,
      artist: str(body.artist),
      track: str(body.track),
      album: str(body.album),
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await params).id);
    if (id === null) {
      return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
    }
    if (!getPlaylist(id)) {
      return NextResponse.json({ error: "Playlist not found." }, { status: 404 });
    }

    const body = (await request.json()) as { orderedTrackIds?: unknown };
    const ids = body.orderedTrackIds;
    if (
      !Array.isArray(ids) ||
      !ids.every((n) => Number.isInteger(n) && (n as number) > 0)
    ) {
      return NextResponse.json(
        { error: "`orderedTrackIds` must be an array of track ids." },
        { status: 400 },
      );
    }

    reorderTracks(id, ids as number[]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
