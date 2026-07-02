import Link from "next/link";
import { notFound } from "next/navigation";
import { MonthlyArea } from "@/components/artists/monthly-area";
import { YearTimeline } from "@/components/artists/year-timeline";
import { RankingList } from "@/components/ranking-list";
import { fmtDate, fmtInt, fmtMinutes } from "@/lib/format";
import {
  getArtistTracks,
  getAvailableYears,
  getTrackMonths,
  getTrackSummary,
  getTrackYears,
} from "@/lib/queries";
import { artistHref, trackHref } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ artist: string; track: string }>;
}) {
  const { artist, track } = await params;
  const artistName = decodeURIComponent(artist);
  const trackName = decodeURIComponent(track);
  const summary = getTrackSummary(artistName, trackName);
  if (!summary) notFound();

  const years = getTrackYears(artistName, trackName);
  const months = getTrackMonths(artistName, trackName);
  const allYears = [...getAvailableYears()].sort((a, b) => a - b);
  const moreByArtist = getArtistTracks(artistName, 11).filter(
    (t) => t.trackName !== trackName,
  );

  const skipStat =
    summary.skipKnownPlays === 0
      ? { value: "—", label: "skips (no data)" }
      : {
          value: fmtInt(summary.skips),
          label: `skips (${Math.round((summary.skips / summary.skipKnownPlays) * 100)}% of plays)`,
        };

  const stats: { value: string; label: string }[] = [
    { value: fmtInt(summary.meaningfulPlays), label: "plays" },
    { value: fmtMinutes(summary.listeningMinutes), label: "listened" },
    skipStat,
    { value: fmtDate(summary.firstPlayedAt), label: "first played" },
    { value: fmtDate(summary.lastPlayedAt), label: "last played" },
  ];

  return (
    <div className="flex flex-col gap-10">
      <nav className="pt-2 text-xs lowercase tracking-wide text-muted-foreground">
        <Link href="/skips" className="transition-colors hover:text-foreground">
          ← skips
        </Link>
      </nav>

      <header className="flex flex-col gap-6 border-b border-border pb-10">
        <div>
          <h1 className="font-display text-5xl lowercase leading-none tracking-tight sm:text-7xl">
            {summary.trackName}
          </h1>
          <p className="mt-3 text-sm lowercase text-muted-foreground">
            by{" "}
            <Link
              href={artistHref(summary.artistName)}
              className="text-foreground transition-colors hover:text-primary"
            >
              {summary.artistName}
            </Link>
            {summary.albumName && <> · {summary.albumName}</>}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label}>
              <dd className="stat-numeral text-2xl sm:text-3xl">{s.value}</dd>
              <dt className="mt-1.5 text-xs lowercase tracking-widest text-muted-foreground">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </header>

      {/* same signature visualization as artist pages: the arc, year by year */}
      <section className="flex flex-col gap-5">
        <h2 className="font-display text-3xl lowercase tracking-tight">
          the arc
        </h2>
        <YearTimeline buckets={years} allYears={allYears} />
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="font-display text-3xl lowercase tracking-tight">
          month by month
        </h2>
        <MonthlyArea buckets={months} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <RankingList
          title={`more by ${summary.artistName}`}
          rows={moreByArtist.slice(0, 10).map((t) => ({
            name: t.trackName,
            href: trackHref(t.artistName, t.trackName),
            value: `${fmtInt(t.meaningfulPlays)} plays`,
            subValue: fmtMinutes(t.listeningMinutes),
          }))}
          emptyMessage="nothing else by this artist"
        />
      </section>
    </div>
  );
}
