import Link from "next/link";
import { notFound } from "next/navigation";
import { MonthlyArea } from "@/components/artists/monthly-area";
import { YearTimeline } from "@/components/artists/year-timeline";
import { RankingList } from "@/components/ranking-list";
import { fmtDate, fmtInt, fmtMinutes } from "@/lib/format";
import {
  getArtistAlbums,
  getArtistMonths,
  getArtistSummary,
  getArtistTracks,
  getArtistYears,
  getAvailableYears,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ artist: string }>;
}) {
  const { artist } = await params;
  const artistName = decodeURIComponent(artist);
  const summary = getArtistSummary(artistName);
  if (!summary) notFound();

  const years = getArtistYears(artistName);
  const months = getArtistMonths(artistName);
  const albums = getArtistAlbums(artistName, 10);
  const tracks = getArtistTracks(artistName, 10);
  const allYears = [...getAvailableYears()].sort((a, b) => a - b);

  const stats: { value: string; label: string }[] = [
    { value: fmtInt(summary.meaningfulPlays), label: "plays" },
    { value: fmtInt(summary.listeningMinutes / 60), label: "hours" },
    { value: fmtInt(summary.distinctTracks), label: "tracks" },
    { value: fmtDate(summary.firstPlayedAt), label: "first played" },
    { value: fmtDate(summary.lastPlayedAt), label: "last played" },
  ];

  return (
    <div className="flex flex-col gap-10">
      <nav className="pt-2 text-xs lowercase tracking-wide text-muted-foreground">
        <Link href="/artists" className="transition-colors hover:text-foreground">
          ← all artists
        </Link>
      </nav>

      <header className="flex flex-col gap-6 border-b border-border pb-10">
        <h1 className="font-display text-5xl lowercase leading-none tracking-tight sm:text-7xl">
          {summary.artistName}
        </h1>
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

      {/* signature: the arc of the relationship, year by year */}
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
          title="top albums"
          rows={albums.map((a) => ({
            name: a.albumName,
            value: fmtMinutes(a.listeningMinutes),
            subValue: `${fmtInt(a.meaningfulPlays)} plays`,
          }))}
        />
        <RankingList
          title="top tracks"
          rows={tracks.map((t) => ({
            name: t.trackName,
            value: `${fmtInt(t.meaningfulPlays)} plays`,
            subValue: fmtMinutes(t.listeningMinutes),
          }))}
        />
      </section>
    </div>
  );
}
