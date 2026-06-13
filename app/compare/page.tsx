import { DeltaList } from "@/components/compare/delta-list";
import { YearPairSelector } from "@/components/compare/year-pair-selector";
import { PageStub } from "@/components/page-stub";
import { RankingList } from "@/components/ranking-list";
import { fmtInt, fmtMinutes } from "@/lib/format";
import {
  getArtistYearDeltas,
  getAvailableYears,
  getOverviewStats,
  getTopArtists,
  yearRange,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function CompareYearsPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const years = getAvailableYears();
  if (years.length < 2) {
    return (
      <PageStub
        title="compare years"
        description="Once two listening years exist in the archive, they can go head to head here."
      />
    );
  }

  const params = await searchParams;
  const reqA = Number(params.a);
  const reqB = Number(params.b);
  // default: the two most recent years, earlier on the left
  const b = years.includes(reqB) ? reqB : years[0];
  const a = years.includes(reqA) && reqA !== b ? reqA : (years.find((y) => y !== b) ?? years[1]);

  const statsA = getOverviewStats(yearRange(a));
  const statsB = getOverviewStats(yearRange(b));
  const topA = getTopArtists(yearRange(a), "minutes", 25);
  const topB = getTopArtists(yearRange(b), "minutes", 25);

  const namesA = new Set(topA.map((r) => r.artistName));
  const namesB = new Set(topB.map((r) => r.artistName));
  const entered = topB.filter((r) => !namesA.has(r.artistName));
  const left = topA.filter((r) => !namesB.has(r.artistName));

  // rises / falls / prominent in both (task 6.2)
  const deltas = getArtistYearDeltas(a, b);
  const rises = deltas.filter((d) => d.deltaMinutes > 0).slice(0, 10);
  const falls = deltas
    .filter((d) => d.deltaMinutes < 0)
    .sort((x, y) => x.deltaMinutes - y.deltaMinutes)
    .slice(0, 10);
  const prominentBoth = deltas
    .filter((d) => namesA.has(d.artistName) && namesB.has(d.artistName))
    .sort((x, y) => y.minutesA + y.minutesB - (x.minutesA + x.minutesB))
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-5xl lowercase tracking-tight">
            compare years
          </h1>
          <p className="mt-1 text-sm lowercase text-muted-foreground">
            <span className="text-chart-2">{a}</span> against{" "}
            <span className="text-primary">{b}</span>
          </p>
        </div>
        <YearPairSelector years={years} a={a} b={b} />
      </section>

      {/* annual totals, side by side */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {[
          { year: a, stats: statsA, accent: "text-chart-2" },
          { year: b, stats: statsB, accent: "text-primary" },
        ].map(({ year, stats, accent }) => (
          <div key={year} className="bg-card px-5 py-6">
            <div className={`stat-numeral text-4xl sm:text-5xl ${accent}`}>
              {year}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-4">
              <div>
                <dd className="stat-numeral text-xl sm:text-2xl">
                  {fmtInt(stats.listeningHours)}
                </dd>
                <dt className="mt-1 text-xs lowercase tracking-widest text-muted-foreground">
                  hours
                </dt>
              </div>
              <div>
                <dd className="stat-numeral text-xl sm:text-2xl">
                  {fmtInt(stats.meaningfulPlays)}
                </dd>
                <dt className="mt-1 text-xs lowercase tracking-widest text-muted-foreground">
                  plays
                </dt>
              </div>
              <div>
                <dd className="stat-numeral text-xl sm:text-2xl">
                  {fmtInt(stats.uniqueArtists)}
                </dd>
                <dt className="mt-1 text-xs lowercase tracking-widest text-muted-foreground">
                  artists
                </dt>
              </div>
            </dl>
          </div>
        ))}
      </section>

      {/* side-by-side top 25 (task 6.1) */}
      <section className="grid gap-6 lg:grid-cols-2">
        <RankingList
          title={`top artists ${a}`}
          rows={topA.map((r) => ({
            name: r.artistName,
            value: fmtMinutes(r.listeningMinutes),
            subValue: `${fmtInt(r.meaningfulPlays)} plays`,
          }))}
        />
        <RankingList
          title={`top artists ${b}`}
          rows={topB.map((r) => ({
            name: r.artistName,
            value: fmtMinutes(r.listeningMinutes),
            subValue: `${fmtInt(r.meaningfulPlays)} plays`,
          }))}
        />
      </section>

      {/* entered / left the top 25 (task 6.1) */}
      <section className="grid gap-6 lg:grid-cols-2">
        <RankingList
          title={`entered the top 25 in ${b}`}
          emptyMessage="nobody new — a loyal year"
          rows={entered.map((r) => ({
            name: r.artistName,
            value: fmtMinutes(r.listeningMinutes),
            subValue: `#${topB.findIndex((x) => x.artistName === r.artistName) + 1} in ${b}`,
          }))}
        />
        <RankingList
          title={`left the top 25 after ${a}`}
          emptyMessage="nobody left — a loyal year"
          rows={left.map((r) => ({
            name: r.artistName,
            value: fmtMinutes(r.listeningMinutes),
            subValue: `#${topA.findIndex((x) => x.artistName === r.artistName) + 1} in ${a}`,
          }))}
        />
      </section>

      {/* movement between the years (task 6.2) */}
      <section className="grid gap-6 lg:grid-cols-3">
        <DeltaList
          title="biggest rises"
          direction="up"
          rows={rises}
          emptyMessage={`nothing grew from ${a} to ${b}`}
        />
        <DeltaList
          title="biggest falls"
          direction="down"
          rows={falls}
          emptyMessage={`nothing faded from ${a} to ${b}`}
        />
        <RankingList
          title="prominent in both"
          emptyMessage="no shared top-25 artists"
          rows={prominentBoth.map((d) => ({
            name: d.artistName,
            value: fmtMinutes(d.minutesA + d.minutesB),
            subValue: `${fmtMinutes(d.minutesA)} + ${fmtMinutes(d.minutesB)}`,
          }))}
        />
      </section>
    </div>
  );
}
