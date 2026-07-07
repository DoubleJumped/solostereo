"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeBucket } from "@/lib/queries";
import { fmtInt, MONTHS } from "@/lib/format";

/** "2022-03" → "mar 2022"; bare "2022" passes through. */
function bucketLabel(bucket: string): string {
  if (bucket.length === 4) return bucket;
  const [y, m] = bucket.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

interface Point {
  bucket: string;
  hours: number;
  plays: number;
}

function BucketTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2">
      <div className="font-display text-sm lowercase">
        {bucketLabel(p.bucket)}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        <span className="tabular text-primary">{fmtInt(p.hours)} h</span>
        {" · "}
        <span className="tabular">{fmtInt(p.plays)} plays</span>
      </div>
    </div>
  );
}

/**
 * The house time-series area chart — listening hours per month/year bucket,
 * amber on near-black with a hairline grid. Fills its parent box; callers own
 * the sizing wrapper and the empty state. At month grain only each January is
 * ticked, and ticks show just the year, keeping the axis quiet.
 */
export function TimeAreaChart({
  buckets,
  initialHeight,
  yAxisWidth = 40,
}: {
  buckets: TimeBucket[];
  /** Expected pixel height of the parent box, so the first paint sizes
      correctly instead of warning at -1×-1; ResizeObserver corrects width on
      mount. */
  initialHeight: number;
  yAxisWidth?: number;
}) {
  const data: Point[] = buckets.map((b) => ({
    bucket: b.bucket,
    hours: b.listeningMinutes / 60,
    plays: b.meaningfulPlays,
  }));
  const ticks = data
    .filter((d) => d.bucket.length === 4 || d.bucket.endsWith("-01"))
    .map((d) => d.bucket);

  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      initialDimension={{ width: 600, height: initialHeight }}
    >
      <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="timeAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-chart-1)"
              stopOpacity={0.45}
            />
            <stop
              offset="100%"
              stopColor="var(--color-chart-1)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-border)" />
        <XAxis
          dataKey="bucket"
          ticks={ticks}
          tickFormatter={(b: string) => b.slice(0, 4)}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          axisLine={{ stroke: "var(--color-border)" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          width={yAxisWidth}
          tickFormatter={(v: number) => `${fmtInt(v)} h`}
          tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<BucketTooltip />}
          cursor={{ stroke: "var(--color-chart-1)", strokeOpacity: 0.35 }}
        />
        <Area
          type="monotone"
          dataKey="hours"
          stroke="var(--color-chart-1)"
          strokeWidth={1.5}
          fill="url(#timeAreaFill)"
          activeDot={{
            r: 3,
            fill: "var(--color-chart-1)",
            stroke: "var(--color-background)",
            strokeWidth: 1,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
