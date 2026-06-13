import type {
  RankedArtist,
  RankMetric,
  YearArtistTrack,
} from "@/lib/queries";
import { fmtInt, fmtMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Signature graphic (task 4.2): the year's top 25 artists as a designed
 * ranked bar chart — pure HTML/CSS, no chart library. Bar length is scaled
 * to the #1 artist in the selected metric.
 *
 * When topTracksByArtist is supplied, hovering a row reveals that artist's
 * most-played songs *that year* in a popover (pure CSS group-hover).
 */
export function ArtistBars({
  rows,
  metric,
  topTracksByArtist,
}: {
  rows: RankedArtist[];
  metric: RankMetric;
  topTracksByArtist?: Map<string, YearArtistTrack[]>;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        no artists in this year
      </p>
    );
  }

  const value = (r: RankedArtist) =>
    metric === "minutes" ? r.listeningMinutes : r.meaningfulPlays;
  const max = Math.max(...rows.map(value));

  return (
    <ol className="flex flex-col gap-1">
      {rows.map((r, i) => {
        const pct = max > 0 ? (value(r) / max) * 100 : 0;
        const display =
          metric === "minutes"
            ? fmtMinutes(r.listeningMinutes)
            : `${fmtInt(r.meaningfulPlays)} plays`;
        const top = i === 0;
        const tracks = topTracksByArtist?.get(r.artistName);

        return (
          <li
            key={r.artistName}
            className="group relative grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-card"
          >
            <span
              className={cn(
                "stat-numeral text-right text-lg",
                top ? "text-primary" : "text-muted-foreground/70",
              )}
            >
              {i + 1}
            </span>
            <div className="min-w-0">
              <div
                className={cn(
                  "truncate text-sm leading-snug",
                  top &&
                    "font-display text-base lowercase tracking-tight text-primary",
                )}
              >
                {r.artistName}
              </div>
              <div
                aria-hidden
                className={cn(
                  "mt-1 h-1.5 rounded-full",
                  top
                    ? "bg-gradient-to-r from-primary to-primary/40"
                    : "bg-gradient-to-r from-primary/60 to-primary/15",
                )}
                style={{ width: `${Math.max(pct, 1.5)}%` }}
              />
            </div>
            <span className="tabular pl-2 text-right text-xs text-muted-foreground">
              {display}
            </span>

            {tracks && tracks.length > 0 && (
              <div className="pointer-events-none absolute left-10 top-full z-30 mt-1 hidden w-64 rounded-md border border-border bg-popover p-3 shadow-xl group-hover:block">
                <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  most played this year
                </div>
                <ol className="flex flex-col gap-1.5">
                  {tracks.map((t, ti) => (
                    <li
                      key={t.trackName}
                      className="flex items-baseline justify-between gap-3 text-xs"
                    >
                      <span className="min-w-0 truncate">
                        <span className="tabular mr-1.5 text-muted-foreground/60">
                          {ti + 1}
                        </span>
                        {t.trackName}
                      </span>
                      <span className="tabular shrink-0 text-primary">
                        {fmtInt(t.meaningfulPlays)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
