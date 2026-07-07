"use client";

import { useState } from "react";
import type { TimeBucket } from "@/lib/queries";
import { chipClass } from "@/lib/utils";
import { TimeAreaChart } from "@/components/time-area-chart";

type Granularity = "month" | "year";

/**
 * Signature hero (task 3.3): a decade of listening as a full-width area
 * chart, restyled to the design system — amber on near-black, hairline grid.
 */
export function ListeningHero({
  monthBuckets,
  yearBuckets,
}: {
  monthBuckets: TimeBucket[];
  yearBuckets: TimeBucket[];
}) {
  const [granularity, setGranularity] = useState<Granularity>("month");
  const buckets = granularity === "month" ? monthBuckets : yearBuckets;

  return (
    <section
      aria-label="listening over time"
      className="crt rounded-lg border border-border bg-card"
    >
      <div className="flex items-baseline justify-between px-5 pt-5">
        <h2 className="font-display text-2xl lowercase tracking-tight">
          listening over time
        </h2>
        <div className="flex gap-1 font-display text-base lowercase tracking-wide">
          {(["month", "year"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={chipClass(granularity === g)}
            >
              by {g}
            </button>
          ))}
        </div>
      </div>

      {buckets.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
          no listening in this period
        </div>
      ) : (
        <div className="h-72 w-full px-2 pb-2 pt-4">
          {/* initialHeight matches the padded box (h-72 − py = 264px). */}
          <TimeAreaChart buckets={buckets} initialHeight={264} yAxisWidth={44} />
        </div>
      )}
    </section>
  );
}
