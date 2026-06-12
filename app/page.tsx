import { Wordmark } from "@/components/wordmark";

const ghostStats = [
  { label: "plays" },
  { label: "hours" },
  { label: "artists" },
  { label: "albums" },
  { label: "tracks" },
];

/**
 * Overview placeholder (task 0.5): the empty-state skeleton of the future
 * dashboard. Ghost stat cards and a ghost hero chart show where real data
 * lands in Phase 3.
 */
export default function OverviewPage() {
  return (
    <div className="flex flex-col gap-12">
      <section className="pt-10">
        <Wordmark asLink={false} className="text-6xl sm:text-7xl" />
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          a personal listening archive — every play since 2014, typeset like
          it deserves.
        </p>
      </section>

      {/* future summary cards row */}
      <section
        aria-label="summary (no data yet)"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5"
      >
        {ghostStats.map(({ label }, i) => (
          <div
            key={label}
            className={
              i === ghostStats.length - 1
                ? "col-span-2 bg-card px-5 py-6 sm:col-span-1"
                : "bg-card px-5 py-6"
            }
          >
            <div className="stat-numeral text-4xl text-muted-foreground/40">
              —
            </div>
            <div className="mt-2 text-xs lowercase tracking-widest text-muted-foreground">
              {label}
            </div>
          </div>
        ))}
      </section>

      {/* future signature hero chart */}
      <section
        aria-label="listening over time (no data yet)"
        className="relative flex h-64 flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-card"
      >
        {/* quiet baseline where a decade of listening will draw itself */}
        <svg
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 w-full text-primary/15"
          preserveAspectRatio="none"
          viewBox="0 0 100 30"
        >
          <path
            d="M0,28 C15,26 25,20 40,22 C55,24 65,12 80,16 C90,18 95,14 100,15 L100,30 L0,30 Z"
            fill="currentColor"
          />
        </svg>
        <p className="font-display text-2xl lowercase tracking-tight">
          nothing imported yet
        </p>
        <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
          drop your extended streaming history into{" "}
          <code className="font-mono text-xs">data/raw/spotify/</code> and run{" "}
          <code className="font-mono text-xs text-primary">
            npm run import
          </code>{" "}
          — a decade of listening will appear here.
        </p>
      </section>
    </div>
  );
}
