import { PageStub } from "@/components/page-stub";
import { YearSelector } from "@/components/year/year-selector";
import { fmtInt } from "@/lib/format";
import {
  getAvailableYears,
  getOverviewStats,
  getTopArtists,
  yearRange,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function YearInReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; metric?: string }>;
}) {
  const years = getAvailableYears();
  if (years.length === 0) {
    return (
      <PageStub
        title="year in review"
        description="Import your streaming history and every year you have ever listened through will be here."
      />
    );
  }

  const params = await searchParams;
  const requested = Number(params.y);
  const year = years.includes(requested) ? requested : years[0];
  const range = yearRange(year);

  const stats = getOverviewStats(range);
  const topArtist = getTopArtists(range, "minutes", 1)[0];

  return (
    <div className="flex flex-col gap-10">
      <YearSelector
        years={years}
        active={year}
        metric={params.metric}
      />

      {/* editorial Wrapped-style header (task 4.1) */}
      <header className="flex flex-col gap-6 border-b border-border pb-10 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="stat-numeral text-[7rem] leading-[0.85] text-primary sm:text-[10rem]">
          {year}
        </h1>
        <dl className="grid grid-cols-3 gap-8 lg:pb-3">
          <div>
            <dd className="stat-numeral text-4xl sm:text-5xl">
              {fmtInt(stats.listeningHours)}
            </dd>
            <dt className="mt-2 text-xs lowercase tracking-widest text-muted-foreground">
              hours
            </dt>
          </div>
          <div>
            <dd className="stat-numeral text-4xl sm:text-5xl">
              {fmtInt(stats.meaningfulPlays)}
            </dd>
            <dt className="mt-2 text-xs lowercase tracking-widest text-muted-foreground">
              plays
            </dt>
          </div>
          <div>
            <dd className="font-display text-2xl lowercase leading-tight tracking-tight sm:text-3xl">
              {topArtist?.artistName ?? "—"}
            </dd>
            <dt className="mt-2 text-xs lowercase tracking-widest text-muted-foreground">
              top artist
            </dt>
          </div>
        </dl>
      </header>
    </div>
  );
}
