import { getRecentTracks } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Public, read-only metadata. Never contacts Spotify or returns account details. */
export function GET() {
  const tracks = getRecentTracks(100);
  return Response.json({ tracks, latestPlayedAt: tracks[0]?.playedAt ?? null }, {
    headers: { "Cache-Control": "no-store" },
  });
}
