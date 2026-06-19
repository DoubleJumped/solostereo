import { NextResponse } from "next/server";
import { removeTrack, setIncluded } from "@/lib/playlists";

/**
 * Single-track mutations for the editor (task 8B.3).
 *
 *  - PATCH  body `{ included: boolean }` — include/exclude a track in place.
 *  - DELETE — remove a track from its playlist.
 *
 * Both `id` and `trackId` params are promised and must be awaited. The data
 * layer scopes its writes by track id, so we validate ids are numeric and let
 * the (idempotent) mutation run. Bad input → 400 `{ error }`.
 */

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; trackId: string }> },
) {
  try {
    const { id, trackId } = await params;
    if (parseId(id) === null || parseId(trackId) === null) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }

    const body = (await request.json()) as { included?: unknown };
    if (typeof body.included !== "boolean") {
      return NextResponse.json(
        { error: "`included` must be a boolean." },
        { status: 400 },
      );
    }

    setIncluded(parseId(trackId)!, body.included);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; trackId: string }> },
) {
  try {
    const { id, trackId } = await params;
    if (parseId(id) === null || parseId(trackId) === null) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }
    removeTrack(parseId(trackId)!);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
