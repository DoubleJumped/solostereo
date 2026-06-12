"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { RangePreset } from "@/lib/date-range";
import { cn } from "@/lib/utils";

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "all", label: "all time" },
  { key: "ytd", label: "this year" },
  { key: "prev", label: "last year" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "custom", label: "custom" },
];

/**
 * Date-range control (task 3.5): preset chips + a custom from/to picker,
 * persisted in search params so every server query re-runs on change.
 */
export function RangeControl({ active }: { active: RangePreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [customOpen, setCustomOpen] = useState(active === "custom");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");

  function apply(next: URLSearchParams) {
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function setPreset(preset: RangePreset) {
    if (preset === "custom") {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    const next = new URLSearchParams(params);
    next.delete("from");
    next.delete("to");
    if (preset === "all") next.delete("range");
    else next.set("range", preset);
    apply(next);
  }

  function applyCustom() {
    if (!from && !to) return;
    const next = new URLSearchParams(params);
    next.set("range", "custom");
    if (from) next.set("from", from);
    else next.delete("from");
    if (to) next.set("to", to);
    else next.delete("to");
    apply(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="date range"
        className="flex flex-wrap gap-1 text-xs lowercase tracking-wide"
      >
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={cn(
              "rounded-full px-3 py-1 transition-colors",
              active === key || (key === "custom" && customOpen)
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {customOpen && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            from
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground [color-scheme:dark]"
            />
          </label>
          <label className="flex items-center gap-1.5">
            to
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground [color-scheme:dark]"
            />
          </label>
          <button
            onClick={applyCustom}
            className="rounded-full bg-primary/15 px-3 py-1 lowercase tracking-wide text-primary transition-colors hover:bg-primary/25"
          >
            apply
          </button>
        </div>
      )}
    </div>
  );
}
