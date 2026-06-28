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
import { fmtInt } from "@/lib/format";

const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function label(bucket: string): string {
  const [y, m] = bucket.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

function MonthTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: { bucket: string; hours: number; plays: number } }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2">
      <div className="font-display text-sm lowercase">{label(p.bucket)}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        <span className="tabular text-primary">{fmtInt(p.hours)} h</span>
        {" · "}
        <span className="tabular">{fmtInt(p.plays)} plays</span>
      </div>
    </div>
  );
}

/** Monthly listening for one artist, in the house chart style. */
export function MonthlyArea({ buckets }: { buckets: TimeBucket[] }) {
  const data = buckets.map((b) => ({
    bucket: b.bucket,
    hours: b.listeningMinutes / 60,
    plays: b.meaningfulPlays,
  }));
  const ticks = data
    .filter((d) => d.bucket.endsWith("-01"))
    .map((d) => d.bucket);

  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        no monthly listening
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      {/* initialDimension matches the h-56 box (224px) so the first paint sizes
          correctly instead of warning at -1×-1; ResizeObserver corrects width
          on mount. */}
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 600, height: 224 }}
      >
        <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="artistFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.45} />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
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
            width={40}
            tickFormatter={(v: number) => `${fmtInt(v)} h`}
            tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<MonthTooltip />}
            cursor={{ stroke: "var(--color-chart-1)", strokeOpacity: 0.35 }}
          />
          <Area
            type="monotone"
            dataKey="hours"
            stroke="var(--color-chart-1)"
            strokeWidth={1.5}
            fill="url(#artistFill)"
            activeDot={{
              r: 3,
              fill: "var(--color-chart-1)",
              stroke: "var(--color-background)",
              strokeWidth: 1,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
