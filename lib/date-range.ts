import type { DateRange } from "./queries";

/**
 * Date-range presets (task 3.5). All boundaries are UTC dates (plan.md §5.2).
 */
export type RangePreset = "all" | "ytd" | "prev" | "30d" | "90d" | "custom";

export interface ResolvedRange {
  preset: RangePreset;
  range: DateRange;
  /** editorial label, e.g. "all time", "2026 so far", "mar 14 – jun 12, 2026" */
  label: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number, now: Date): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date(),
): ResolvedRange {
  const year = now.getUTCFullYear();
  switch (params.range) {
    case "ytd":
      return {
        preset: "ytd",
        range: { from: `${year}-01-01` },
        label: `${year} so far`,
      };
    case "prev":
      return {
        preset: "prev",
        range: { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
        label: `${year - 1}`,
      };
    case "30d":
      return {
        preset: "30d",
        range: { from: daysAgo(30, now) },
        label: "last 30 days",
      };
    case "90d":
      return {
        preset: "90d",
        range: { from: daysAgo(90, now) },
        label: "last 90 days",
      };
    case "custom": {
      const from = params.from && ISO_DATE.test(params.from) ? params.from : undefined;
      const to = params.to && ISO_DATE.test(params.to) ? params.to : undefined;
      if (!from && !to) break; // malformed custom → all time
      return {
        preset: "custom",
        range: { from, to },
        label: `${from ?? "start"} – ${to ?? "now"}`,
      };
    }
  }
  return { preset: "all", range: {}, label: "all time" };
}
