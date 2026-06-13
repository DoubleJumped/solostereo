"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtInt } from "@/lib/format";

const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

export interface OverlayPoint {
  month: number; // 1..12
  hoursA: number;
  hoursB: number;
}

function OverlayTooltip({
  active,
  payload,
  yearA,
  yearB,
}: {
  active?: boolean;
  payload?: { payload: OverlayPoint }[];
  yearA: number;
  yearB: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2">
      <div className="font-display text-sm lowercase">
        {MONTH_NAMES[p.month - 1]}
      </div>
      <div className="mt-0.5 flex flex-col text-xs">
        <span>
          <span className="text-chart-2">{yearA}</span>{" "}
          <span className="tabular text-muted-foreground">
            {fmtInt(p.hoursA)} h
          </span>
        </span>
        <span>
          <span className="text-primary">{yearB}</span>{" "}
          <span className="tabular text-muted-foreground">
            {fmtInt(p.hoursB)} h
          </span>
        </span>
      </div>
    </div>
  );
}

/** Signature (task 6.3a): both years' monthly curves in one designed chart. */
export function MonthlyOverlay({
  points,
  yearA,
  yearB,
}: {
  points: OverlayPoint[];
  yearA: number;
  yearB: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl lowercase tracking-tight">
          month by month
        </h2>
        <div className="flex gap-4 text-xs lowercase tracking-wide">
          <span className="text-chart-2">— {yearA}</span>
          <span className="text-primary">— {yearB}</span>
        </div>
      </div>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="month"
              tickFormatter={(m: number) => MONTH_NAMES[m - 1]}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              width={40}
              tickFormatter={(v: number) => `${fmtInt(v)} h`}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<OverlayTooltip yearA={yearA} yearB={yearB} />}
              cursor={{ stroke: "var(--color-chart-1)", strokeOpacity: 0.35 }}
            />
            <Line
              type="monotone"
              dataKey="hoursA"
              stroke="var(--color-chart-2)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "var(--color-chart-2)" }}
            />
            <Line
              type="monotone"
              dataKey="hoursB"
              stroke="var(--color-chart-1)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, fill: "var(--color-chart-1)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
