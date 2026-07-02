import Link from "next/link";
import { PageStub } from "@/components/page-stub";
import { RankingList } from "@/components/ranking-list";
import { fmtInt } from "@/lib/format";
import {
  getMostSkippedTracks,
  getNeverSkippedTracks,
  getOverviewStats,
  type SkippedTrackRow,
} from "@/lib/queries";
import { cn, trackHref } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** Threshold choices for the never-skipped list ("min" search param). */
const MIN_PLAY_OPTIONS = [10, 25, 50, 100];
const DEFAULT_MIN_PLAYS = 25;

function skipRate(row: SkippedTrackRow): string {
  if (row.skipKnownPlays === 0) return "no skip data";
  return `${Math.round((row.skips / row.skipKnownPlays) * 100)}% of ${fmtInt(row.skipKnownPlays)} plays`;
}

export default async function SkipsPage({
  searchParams,
}: {
  searchParams: Promise<{ min?: string }>;
}) {
  if (getOverviewStats().rawPlays === 0) {
    return (
      <PageStub
        title="skips"
        description="Import your streaming history to see which tracks you skip and which you always let play."
      />
    );
  }

  const params = await searchParams;
  const parsed = Number.parseInt(params.min ?? "", 10);
  const minPlays =
    Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_PLAYS;

  const mostSkipped = getMostSkippedTracks(20);
  const neverSkipped = getNeverSkippedTracks(minPlays, 20);

  return (
    <div className="flex flex-col gap-10">
      <section className="pt-2">
        <h1 className="font-display text-5xl lowercase tracking-tight">
          skips
        </h1>
        <p className="mt-1 text-sm lowercase text-muted-foreground">
          what you abandon, and what you always let play
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-4">
          <p className="px-3 py-1 text-xs lowercase tracking-wide text-muted-foreground">
            a skip = bailed in the first 30 seconds · api-synced plays carry
            no skip data
          </p>
          <RankingList
            title="most skipped"
            rows={mostSkipped.map((t) => ({
              name: t.trackName,
              sub: t.artistName,
              href: trackHref(t.artistName, t.trackName),
              value: `${fmtInt(t.skips)} skips`,
              subValue: skipRate(t),
            }))}
          />
        </section>

        <section className="flex flex-col gap-4">
          <div
            role="group"
            aria-label="minimum plays"
            className="flex flex-wrap items-baseline gap-1 font-display text-base lowercase tracking-wide"
          >
            <span className="mr-1 text-muted-foreground">at least</span>
            {MIN_PLAY_OPTIONS.map((n) => (
              <Link
                key={n}
                href={n === DEFAULT_MIN_PLAYS ? "/skips" : `/skips?min=${n}`}
                className={cn(
                  "rounded-sm border px-3 py-0.5 transition-colors",
                  minPlays === n
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {n} plays
              </Link>
            ))}
          </div>
          <RankingList
            title="never skipped"
            rows={neverSkipped.map((t) => ({
              name: t.trackName,
              sub: t.artistName,
              href: trackHref(t.artistName, t.trackName),
              value: `${fmtInt(t.meaningfulPlays)} plays`,
              subValue: "0 skips",
            }))}
            emptyMessage={`no track has ${minPlays}+ plays without a single skip`}
          />
        </section>
      </div>
    </div>
  );
}
