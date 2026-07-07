import type { PlaylistTrackRow } from "@/lib/playlists";

/** Row class for a playlist track list item, dimmed when excluded. */
export function trackRowClass(included: boolean): string {
  return `flex items-center gap-3 border-b border-border bg-card px-4 py-3 last:border-b-0 ${
    included ? "" : "opacity-40"
  }`;
}

/**
 * The shared left block of a playlist track row — index numeral plus
 * track/artist/album/reason — used by both the interactive editor row and the
 * read-only demo list item.
 */
export function TrackInfo({
  track,
  index,
}: {
  track: Pick<PlaylistTrackRow, "track" | "artist" | "album" | "reason">;
  index: number;
}) {
  return (
    <>
      <span className="tabular w-7 shrink-0 text-right text-xs text-muted-foreground">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm lowercase">
          {track.track ?? "unknown track"}
          {track.artist ? (
            <span className="text-muted-foreground"> — {track.artist}</span>
          ) : null}
        </span>
        {track.album && (
          <span className="truncate text-xs text-muted-foreground">
            {track.album}
          </span>
        )}
        {track.reason && (
          <span className="truncate text-xs italic text-muted-foreground">
            {track.reason}
          </span>
        )}
      </div>
    </>
  );
}
