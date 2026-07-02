"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * plays ↔ minutes ranking toggle, persisted in the `metric` search param so
 * the server re-ranks. With no param, each list uses its plan.md §8 default
 * (artists/albums by minutes, tracks by plays); clicking the active chip
 * clears back to defaults.
 */
export function MetricToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const active = params.get("metric");

  function setMetric(metric: string) {
    const next = new URLSearchParams(params);
    if (active === metric) next.delete("metric");
    else next.set("metric", metric);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex gap-1 font-display text-base lowercase tracking-wide">
      {(["plays", "minutes"] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMetric(m)}
          className={cn(
            "rounded-sm border px-3 py-0.5 transition-colors",
            active === m
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          by {m}
        </button>
      ))}
    </div>
  );
}
