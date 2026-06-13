import crypto from "node:crypto";

export interface DedupFields {
  playedAt: string;
  trackUri?: string | null;
  episodeUri?: string | null;
  chapterUri?: string | null;
  trackName?: string | null;
  artistName?: string | null;
  albumName?: string | null;
  msPlayed: number;
}

/**
 * Deterministic dedup hash (plan.md §7). The field order is a contract shared
 * by the historical importer and the live Spotify sync — changing it would
 * invalidate every existing row's hash. Null fields hash as empty strings.
 */
export function dedupHash(f: DedupFields): string {
  const parts = [
    f.playedAt,
    f.trackUri ?? "",
    f.episodeUri ?? "",
    f.chapterUri ?? "",
    f.trackName ?? "",
    f.artistName ?? "",
    f.albumName ?? "",
    String(f.msPlayed ?? 0),
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}
