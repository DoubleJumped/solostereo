import type { ArtistYearBucket } from "@/lib/queries";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Signature visualization (task 5.2): the arc of a relationship with an
 * artist — listening hours per calendar year, peak year in amber. Years with
 * no listening render as gaps, which is part of the story.
 */
export function YearTimeline({
  buckets,
  allYears,
}: {
  buckets: ArtistYearBucket[];
  allYears: number[]; // every year in the archive, ascending
}) {
  const byYear = new Map(buckets.map((b) => [b.year, b]));
  const max = Math.max(...buckets.map((b) => b.listeningMinutes), 1);
  const peak = buckets.reduce(
    (best, b) => (b.listeningMinutes > best.listeningMinutes ? b : best),
    buckets[0],
  );

  return (
    <div className="grid auto-cols-fr grid-flow-col gap-2">
      {allYears.map((year) => {
        const b = byYear.get(year);
        const hours = (b?.listeningMinutes ?? 0) / 60;
        const isPeak = b != null && peak != null && b.year === peak.year;
        return (
          <div key={year} className="flex min-w-0 flex-col">
            <div className="flex h-40 items-end">
              {b ? (
                <div
                  className={cn(
                    "w-full rounded-t-sm",
                    isPeak ? "bg-primary" : "bg-primary/25",
                  )}
                  style={{
                    height: `${Math.max((b.listeningMinutes / max) * 100, 2)}%`,
                  }}
                  title={`${year}: ${fmtInt(hours)} h · ${fmtInt(b.meaningfulPlays)} plays`}
                />
              ) : (
                <div className="h-px w-full bg-border" title={`${year}: nothing`} />
              )}
            </div>
            <div
              className={cn(
                "tabular mt-2 text-xs",
                isPeak ? "text-primary" : "text-muted-foreground",
              )}
            >
              {b ? `${fmtInt(hours)}h` : "·"}
            </div>
            <div className="tabular text-[10px] text-muted-foreground">
              {year}
            </div>
          </div>
        );
      })}
    </div>
  );
}
