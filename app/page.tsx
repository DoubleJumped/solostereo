import { MetricToggle } from "@/components/metric-toggle";
import { OverviewEmptyState } from "@/components/overview/empty-state";
import { ListeningHero } from "@/components/overview/listening-hero";
import { SummaryCards } from "@/components/overview/summary-cards";
import { RankingList } from "@/components/ranking-list";
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
  searchParams: Promise<{ metric?: string }>;
}) {
  const stats = getOverviewStats();
  if (stats.rawPlays === 0) return <OverviewEmptyState />;

  const params = await searchParams;
  const forced =
    params.metric === "plays" || params.metric === "minutes"
      ? (params.metric as RankMetric)
      : undefined;
  // §8 defaults: artists/albums rank by minutes, tracks by meaningful plays.
  const artistMetric = forced ?? "minutes";
  const albumMetric = forced ?? "minutes";
  const trackMetric = forced ?? "plays";

  const monthBuckets = getListeningOverTime("month");
  const yearBuckets = getListeningOverTime("year");
  const topArtists = getTopArtists({}, artistMetric, 10);
  const topAlbums = getTopAlbums({}, albumMetric, 10);
  const topTracks = getTopTracks({}, trackMetric, 10);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex items-baseline justify-between pt-2">
        <h1 className="font-display text-5xl lowercase tracking-tight">
          overview
        </h1>
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
