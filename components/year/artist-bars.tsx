import type { RankedArtist, RankMetric } from "@/lib/queries";
import { fmtInt, fmtMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Signature graphic (task 4.2): the year's top 25 artists as a designed
 * ranked bar chart — pure HTML/CSS, no chart library. Bar length is scaled
 * to the #1 artist in the selected metric.
 */
export function ArtistBars({
  rows,
  metric,
}: {
  rows: RankedArtist[];
  metric: RankMetric;
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
    <ol className="flex flex-col gap-2.5">
      {rows.map((r, i) => {
        const pct = max > 0 ? (value(r) / max) * 100 : 0;
        const display =
          metric === "minutes"
            ? fmtMinutes(r.listeningMinutes)
            : `${fmtInt(r.meaningfulPlays)} plays`;
        const top = i === 0;
        return (
          <li key={r.artistName} className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3">
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
                  top && "font-display text-base lowercase tracking-tight text-primary",
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
          </li>
        );
      })}
    </ol>
  );
}
