import { type NextRequest, NextResponse } from "next/server";
import { searchLocalTracks } from "@/lib/playlists";

/**
 * Local-catalogue track search for manual-add (task 8B.4).
 *
 * GET `?q=` → up to `limit` matching local tracks (track/artist substring).
 * Empty or too-short queries return `[]` (no point hitting the DB for a single
 * character). `params`-free route, but reads `request.nextUrl.searchParams`.
 */
export function GET(request: NextRequest) {
  try {
    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      return NextResponse.json([]);
    }
    return NextResponse.json(searchLocalTracks(q, 20));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
