import type { ReactNode } from "react";
import type { OverviewStats } from "@/lib/queries";
import { fmtInt, fmtMonthYear } from "@/lib/format";

function Card({
  value,
  label,
  hint,
  small = false,
}: {
  value: ReactNode;
  label: string;
  hint?: string;
  small?: boolean;
}) {
  return (
    <div className="bg-card px-5 py-6" title={hint}>
      <div
        className={
          small
            ? "stat-numeral pt-1 text-lg leading-snug sm:text-xl"
            : "stat-numeral text-[2.1rem] leading-none sm:text-4xl"
        }
      >
        {value}
      </div>
      <div className="mt-2 text-xs lowercase tracking-widest text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** Summary cards row (task 3.2): the period's vitals at a glance. */
export function SummaryCards({ stats }: { stats: OverviewStats }) {
  return (
    <section
      aria-label="listening summary"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3 lg:grid-cols-6"
    >
      <Card
        value={fmtInt(stats.meaningfulPlays)}
        label="plays"
        hint={`${fmtInt(stats.rawPlays)} raw events incl. skips`}
      />
      <Card value={fmtInt(stats.listeningHours)} label="hours" />
      <Card value={fmtInt(stats.uniqueArtists)} label="artists" />
      <Card value={fmtInt(stats.uniqueAlbums)} label="albums" />
      <Card value={fmtInt(stats.uniqueTracks)} label="tracks" />
      <Card
        value={
          stats.firstEvent && stats.lastEvent ? (
            <>
              <span className="block whitespace-nowrap">
                {fmtMonthYear(stats.firstEvent)}
              </span>
              <span className="block whitespace-nowrap text-muted-foreground">
                &ndash; {fmtMonthYear(stats.lastEvent)}
              </span>
            </>
          ) : (
            "—"
          )
        }
        label="listening span"
        small
      />
    </section>
  );
}
