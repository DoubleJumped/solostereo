import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTH_ABBREV = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

export interface MonthCell {
  month: number; // 1..12
  hours: number;
  topArtist?: string;
}

/**
 * Monthly listening trend + top-artist-per-month strip (task 4.4).
 * Custom HTML bars; the strongest month is amber, the rest stay quiet.
 */
export function MonthlyStrip({ months }: { months: MonthCell[] }) {
  const max = Math.max(...months.map((m) => m.hours), 1);
  const peak = months.reduce(
    (best, m) => (m.hours > best.hours ? m : best),
    months[0],
  );

  return (
    <section className="flex flex-col gap-5">
      <h2 className="font-display text-3xl lowercase tracking-tight">
        the months
      </h2>
      <div className="grid grid-cols-6 gap-x-2 gap-y-6 sm:grid-cols-12">
        {months.map((m) => {
          const isPeak = m.month === peak.month && m.hours > 0;
          return (
            <div key={m.month} className="flex min-w-0 flex-col">
              <div className="flex h-32 items-end">
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-colors",
                    isPeak ? "bg-primary" : "bg-primary/25",
                  )}
                  style={{ height: `${(m.hours / max) * 100}%` }}
                  title={`${MONTH_ABBREV[m.month - 1]}: ${fmtInt(m.hours)} h`}
                />
              </div>
              <div
                className={cn(
                  "tabular mt-2 text-xs",
                  isPeak ? "text-primary" : "text-muted-foreground",
                )}
              >
                {fmtInt(m.hours)}h
              </div>
              <div className="text-[10px] lowercase tracking-widest text-muted-foreground">
                {MONTH_ABBREV[m.month - 1]}
              </div>
              <div
                className={cn(
                  "mt-1 truncate text-[11px] leading-tight",
                  isPeak ? "text-foreground" : "text-muted-foreground",
                )}
                title={m.topArtist}
              >
                {m.topArtist ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
