import type { TimeBucket } from "@/lib/queries";
import { TimeAreaChart } from "@/components/time-area-chart";

/** Monthly listening for one artist, in the house chart style. */
export function MonthlyArea({ buckets }: { buckets: TimeBucket[] }) {
  if (buckets.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        no monthly listening
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      {/* initialHeight matches the h-56 box (224px). */}
      <TimeAreaChart buckets={buckets} initialHeight={224} />
    </div>
  );
}
