import { fmtInt } from "@/lib/format";
import type { PlaylistTrackRow } from "@/lib/playlists";

/**
 * Read-only tracklist shown in demo mode in place of the interactive
 * PlaylistEditor — the editor's actions (reorder, edit, push to Spotify,
 * delete) all write, which the demo's read-only database blocks. Visitors can
 * still see what a generated playlist looks like.
 */
export function DemoPlaylistView({ tracks }: { tracks: PlaylistTrackRow[] }) {
  const included = tracks.filter((t) => t.included);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl lowercase tracking-tight">
          tracks
        </h2>
        <span className="text-xs lowercase tracking-widest text-muted-foreground">
          {fmtInt(included.length)} included
        </span>
      </div>
      {tracks.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm lowercase text-muted-foreground">
          no tracks.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {tracks.map((t, i) => (
            <li
              key={t.id}
              className={`flex items-center gap-3 border-b border-border bg-card px-4 py-3 last:border-b-0 ${
                t.included ? "" : "opacity-40"
              }`}
            >
              <span className="tabular w-7 shrink-0 text-right text-xs text-muted-foreground">
                {i + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm lowercase">
                  {t.track ?? "unknown track"}
                  {t.artist ? (
                    <span className="text-muted-foreground"> — {t.artist}</span>
                  ) : null}
                </span>
                {t.album && (
                  <span className="truncate text-xs text-muted-foreground">
                    {t.album}
                  </span>
                )}
                {t.reason && (
                  <span className="truncate text-xs italic text-muted-foreground">
                    {t.reason}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs lowercase text-muted-foreground">
        editing, reordering, and pushing to spotify are disabled in the demo.
      </p>
    </section>
  );
}
