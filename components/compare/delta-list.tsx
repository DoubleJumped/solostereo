import type { ArtistYearDelta } from "@/lib/queries";
import { fmtMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Rises/falls list (task 6.2): year-over-year listening change per artist,
 * with the A → B trajectory spelled out.
 */
export function DeltaList({
  title,
  rows,
  direction,
  emptyMessage,
}: {
  title: string;
  rows: ArtistYearDelta[];
  direction: "up" | "down";
  emptyMessage: string;
}) {
  const up = direction === "up";
  return (
    <section className="flex flex-col rounded-lg border border-border bg-card">
      <h2 className="px-5 pb-1 pt-5 font-display text-2xl lowercase tracking-tight">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-5 pb-6 pt-2 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ol className="px-2 pb-3">
          {rows.map((r) => (
            <li
              key={r.artistName}
              className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{r.artistName}</span>
                <span className="tabular block text-xs text-muted-foreground">
                  {fmtMinutes(r.minutesA)} → {fmtMinutes(r.minutesB)}
                </span>
              </span>
              <span
                className={cn(
                  "tabular shrink-0 text-sm",
                  up ? "text-primary" : "text-muted-foreground",
                )}
              >
                {up ? "+" : "−"}
                {fmtMinutes(Math.abs(r.deltaMinutes))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
