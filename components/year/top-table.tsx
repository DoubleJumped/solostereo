import { fmtInt, fmtMinutes } from "@/lib/format";
import type { RankMetric } from "@/lib/queries";
import { cn } from "@/lib/utils";

export interface TopTableRow {
  name: string;
  artist: string;
  meaningfulPlays: number;
  listeningMinutes: number;
}

/**
 * Dense ranked table for albums/tracks (task 4.3) — density in service of
 * the data: hairline rows, tabular figures, ranking column emphasized.
 */
export function TopTable({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: TopTableRow[];
  metric: RankMetric;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <h2 className="font-display text-3xl lowercase tracking-tight">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">nothing this year</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs lowercase tracking-widest text-muted-foreground">
              <th className="w-8 pb-2 pr-2 text-right font-normal">#</th>
              <th className="pb-2 pr-3 font-normal">title</th>
              <th
                className={cn(
                  "w-16 pb-2 pr-3 text-right font-normal",
                  metric === "plays" && "text-primary",
                )}
              >
                plays
              </th>
              <th
                className={cn(
                  "w-16 pb-2 text-right font-normal",
                  metric === "minutes" && "text-primary",
                )}
              >
                time
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.artist}|${r.name}`}
                className="border-b border-border/60 last:border-b-0"
              >
                <td className="stat-numeral py-2 pr-2 text-right text-base text-muted-foreground/70">
                  {i + 1}
                </td>
                <td className="min-w-0 py-2 pr-3">
                  <span className="block max-w-[16rem] truncate">{r.name}</span>
                  <span className="block max-w-[16rem] truncate text-xs text-muted-foreground">
                    {r.artist}
                  </span>
                </td>
                <td
                  className={cn(
                    "tabular py-2 pr-3 text-right",
                    metric === "plays" ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {fmtInt(r.meaningfulPlays)}
                </td>
                <td
                  className={cn(
                    "tabular py-2 text-right",
                    metric === "minutes" ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {fmtMinutes(r.listeningMinutes)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
