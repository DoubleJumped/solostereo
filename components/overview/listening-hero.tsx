"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function labelFor(bucket: string): string {
  if (bucket.length === 4) return bucket; // "2022"
  const [y, m] = bucket.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`; // "mar 2022"
}

type Granularity = "month" | "year";

interface Point {
  bucket: string;
  hours: number;
  plays: number;
}

function HeroTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-none">
      <div className="font-display text-sm lowercase">{labelFor(p.bucket)}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        <span className="text-primary tabular">{fmtInt(p.hours)} h</span>
        {" · "}
        <span className="tabular">{fmtInt(p.plays)} plays</span>
      </div>
    </div>
  );
}

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

  const data: Point[] = buckets.map((b) => ({
    bucket: b.bucket,
    hours: b.listeningMinutes / 60,
    plays: b.meaningfulPlays,
  }));

  // At month grain, tick only January of each year to keep the axis quiet.
  const ticks =
    granularity === "month"
      ? data.filter((d) => d.bucket.endsWith("-01")).map((d) => d.bucket)
      : data.map((d) => d.bucket);

  return (
    <section
      aria-label="listening over time"
      className="rounded-lg border border-border bg-card"
    >
      <div className="flex items-baseline justify-between px-5 pt-5">
        <h2 className="font-display text-2xl lowercase tracking-tight">
          listening over time
        </h2>
        <div className="flex gap-1 text-xs lowercase tracking-wide">
          {(["month", "year"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={cn(
                "rounded-full px-3 py-1 transition-colors",
                granularity === g
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              by {g}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
          no listening in this period
        </div>
      ) : (
        <div className="h-72 w-full px-2 pb-2 pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
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
              <CartesianGrid
                vertical={false}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <XAxis
                dataKey="bucket"
                ticks={ticks}
                tickFormatter={(b: string) => b.slice(0, 4)}
                tick={{
                  fill: "var(--color-muted-foreground)",
                  fontSize: 11,
                }}
                axisLine={{ stroke: "var(--color-border)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                width={44}
                tickFormatter={(v: number) => `${fmtInt(v)} h`}
                tick={{
                  fill: "var(--color-muted-foreground)",
                  fontSize: 11,
                }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<HeroTooltip />}
                cursor={{ stroke: "var(--color-chart-1)", strokeOpacity: 0.35 }}
              />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="var(--color-chart-1)"
                strokeWidth={1.5}
                fill="url(#heroFill)"
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
      )}
    </section>
  );
}
