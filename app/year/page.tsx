import { MetricToggle } from "@/components/metric-toggle";
import { PageStub } from "@/components/page-stub";
import { ArtistBars } from "@/components/year/artist-bars";
import { MonthlyStrip, type MonthCell } from "@/components/year/monthly-strip";
import { TopTable } from "@/components/year/top-table";
import { YearSelector } from "@/components/year/year-selector";
import { fmtInt } from "@/lib/format";
import {
  getAvailableYears,
  getListeningOverTime,
  getOverviewStats,
  getTopAlbums,
  getTopArtistPerMonth,
  getTopArtists,
  getTopTracks,
  getYearArtistTopTracks,
  yearRange,
  type RankMetric,
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

  const forced =
    params.metric === "plays" || params.metric === "minutes"
      ? (params.metric as RankMetric)
      : undefined;
  const artistMetric = forced ?? "minutes";

  const stats = getOverviewStats(range);
  const topArtist = getTopArtists(range, "minutes", 1)[0];
  const top25 = getTopArtists(range, artistMetric, 25);
  const artistTopTracks = getYearArtistTopTracks(year);
  const albumMetric = forced ?? "minutes";
  const trackMetric = forced ?? "plays";
  const topAlbums = getTopAlbums(range, albumMetric, 25);
  const topTracks = getTopTracks(range, trackMetric, 25);

  // monthly trend + top artist per month (task 4.4), zero-filled Jan–Dec
  const monthBuckets = getListeningOverTime("month", range);
  const monthArtists = getTopArtistPerMonth(year);
  const months: MonthCell[] = Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    const bucket = monthBuckets.find((b) => b.bucket === key);
    const top = monthArtists.find((a) => Number(a.month) === i + 1);
    return {
      month: i + 1,
      hours: (bucket?.listeningMinutes ?? 0) / 60,
      topArtist: top?.artistName,
    };
  });

  return (
    <div className="flex flex-col gap-10">
      <YearSelector
        years={years}
        active={year}
        metric={params.metric}
      />

      {/* editorial Wrapped-style header (task 4.1) */}
      <header className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="stat-numeral text-6xl leading-none text-primary sm:text-7xl">
          {year}
        </h1>
        <dl className="flex flex-wrap items-end gap-x-12 gap-y-6 lg:pb-2">
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
            <dd className="max-w-[16ch] font-display text-2xl lowercase leading-tight tracking-tight text-primary sm:text-3xl">
              {topArtist?.artistName ?? "—"}
            </dd>
            <dt className="mt-2 text-xs lowercase tracking-widest text-muted-foreground">
              top artist
            </dt>
          </div>
        </dl>
      </header>

      {/* top 25 artists as a designed graphic (task 4.2) */}
      <section className="flex flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-3xl lowercase tracking-tight">
            the artists
          </h2>
          <MetricToggle />
        </div>
        <p className="-mt-3 text-xs lowercase tracking-wide text-muted-foreground">
          hover an artist for their top songs that year
        </p>
        <ArtistBars
          rows={top25}
          metric={artistMetric}
          topTracksByArtist={artistTopTracks}
        />
      </section>

      <MonthlyStrip months={months} />

      {/* ranked album + track tables (task 4.3) */}
      <section className="grid gap-10 lg:grid-cols-2">
        <TopTable
          title="the albums"
          metric={albumMetric}
          rows={topAlbums.map((a) => ({
            name: a.albumName,
            artist: a.artistName,
            meaningfulPlays: a.meaningfulPlays,
            listeningMinutes: a.listeningMinutes,
          }))}
        />
        <TopTable
          title="the tracks"
          metric={trackMetric}
          rows={topTracks.map((t) => ({
            name: t.trackName,
            artist: t.artistName,
            meaningfulPlays: t.meaningfulPlays,
            listeningMinutes: t.listeningMinutes,
          }))}
        />
      </section>
    </div>
  );
}
