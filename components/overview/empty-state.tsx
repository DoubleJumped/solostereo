import { Wordmark } from "@/components/wordmark";

/** Shown when the database has no music events yet. */
export function OverviewEmptyState() {
  return (
    <div className="flex flex-col gap-12">
      <section className="pt-10">
        <Wordmark asLink={false} className="text-6xl sm:text-7xl" />
        <p className="mt-4 max-w-lg text-lg text-muted-foreground">
          a personal listening archive — every play since 2014, sprayed
          across the wall.
        </p>
      </section>
      <section className="relative flex h-64 flex-col items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
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
          <code className="font-mono text-xs text-primary">npm run import</code>{" "}
          — a decade of listening will appear here.
        </p>
      </section>
    </div>
  );
}
