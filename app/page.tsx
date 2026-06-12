import { MetricToggle } from "@/components/metric-toggle";
import { OverviewEmptyState } from "@/components/overview/empty-state";
import { ListeningHero } from "@/components/overview/listening-hero";
import { SummaryCards } from "@/components/overview/summary-cards";
import { RangeControl } from "@/components/range-control";
import { RankingList } from "@/components/ranking-list";
import { resolveRange } from "@/lib/date-range";
import { fmtInt, fmtMinutes } from "@/lib/format";
import {
  getListeningOverTime,
  getOverviewStats,
  getTopAlbums,
  getTopArtists,
  getTopTracks,
  type RankMetric,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

function rankValue(
  row: { meaningfulPlays: number; listeningMinutes: number },
  metric: RankMetric,
): { value: string; subValue: string } {
  return metric === "minutes"
    ? {
        value: fmtMinutes(row.listeningMinutes),
        subValue: `${fmtInt(row.meaningfulPlays)} plays`,
      }
    : {
        value: `${fmtInt(row.meaningfulPlays)} plays`,
        subValue: fmtMinutes(row.listeningMinutes),
      };
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    metric?: string;
    range?: string;
    from?: string;
    to?: string;
  }>;
}) {
  if (getOverviewStats().rawPlays === 0) return <OverviewEmptyState />;

  const params = await searchParams;
  const { preset, range, label } = resolveRange(params);
  const forced =
    params.metric === "plays" || params.metric === "minutes"
      ? (params.metric as RankMetric)
      : undefined;
  // §8 defaults: artists/albums rank by minutes, tracks by meaningful plays.
  const artistMetric = forced ?? "minutes";
  const albumMetric = forced ?? "minutes";
  const trackMetric = forced ?? "plays";

  const stats = getOverviewStats(range);
  const monthBuckets = getListeningOverTime("month", range);
  const yearBuckets = getListeningOverTime("year", range);
  const topArtists = getTopArtists(range, artistMetric, 10);
  const topAlbums = getTopAlbums(range, albumMetric, 10);
  const topTracks = getTopTracks(range, trackMetric, 10);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-5xl lowercase tracking-tight">
            overview
          </h1>
          <p className="mt-1 text-sm lowercase text-muted-foreground">
            {label}
          </p>
        </div>
        <RangeControl active={preset} />
      </section>

      <SummaryCards stats={stats} />

      <ListeningHero monthBuckets={monthBuckets} yearBuckets={yearBuckets} />

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-3xl lowercase tracking-tight">
            heavy rotation
          </h2>
          <MetricToggle />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <RankingList
            title="artists"
            rows={topArtists.map((a) => ({
              name: a.artistName,
              ...rankValue(a, artistMetric),
            }))}
          />
          <RankingList
            title="albums"
            rows={topAlbums.map((a) => ({
              name: a.albumName,
              sub: a.artistName,
              ...rankValue(a, albumMetric),
            }))}
          />
          <RankingList
            title="tracks"
            rows={topTracks.map((t) => ({
              name: t.trackName,
              sub: t.artistName,
              ...rankValue(t, trackMetric),
            }))}
          />
        </div>
      </section>
    </div>
  );
}
