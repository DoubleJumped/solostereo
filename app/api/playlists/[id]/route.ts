import { NextResponse } from "next/server";
import {
  deletePlaylist,
  getPlaylist,
  renamePlaylist,
  setPublic,
} from "@/lib/playlists";

/**
 * Playlist-level mutations for the editor (task 8B.3).
 *
 *  - PATCH  body `{ name?, description?, public? }` — rename and/or replace the
 *    description (when `name` is present), and/or toggle the public flag.
 *  - DELETE — delete the playlist (its tracks cascade via the FK).
 *
 * `params` is a promise in this Next.js version and must be awaited. Bad ids or
 * malformed bodies return 400 `{ error }`, matching the existing convention.
 */

/** Parse a numeric playlist id, or null if it isn't a positive integer. */
function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
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

    const body = (await request.json()) as {
      name?: unknown;
      description?: unknown;
      public?: unknown;
    };

    let changed = false;

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim() === "") {
        return NextResponse.json(
          { error: "Name must be a non-empty string." },
          { status: 400 },
        );
      }
      const description =
        body.description === undefined
          ? undefined
          : typeof body.description === "string"
            ? body.description
            : null;
      if (description === null) {
        return NextResponse.json(
          { error: "Description must be a string." },
          { status: 400 },
        );
      }
      renamePlaylist(id, body.name.trim(), description);
      changed = true;
    }

    if (body.public !== undefined) {
      if (typeof body.public !== "boolean") {
        return NextResponse.json(
          { error: "`public` must be a boolean." },
          { status: 400 },
        );
      }
      setPublic(id, body.public);
      changed = true;
    }

    if (!changed) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = parseId((await params).id);
    if (id === null) {
      return NextResponse.json({ error: "Invalid playlist id." }, { status: 400 });
    }
    deletePlaylist(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
