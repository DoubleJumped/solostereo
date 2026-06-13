"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Two-year picker; persists ?a= and ?b= so the server recomputes. */
export function YearPairSelector({
  years,
  a,
  b,
}: {
  years: number[];
  a: number;
  b: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: "a" | "b", value: string) {
    const next = new URLSearchParams(params);
    next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const select =
    "rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring [color-scheme:dark]";

  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <select
        aria-label="first year"
        className={select}
        value={a}
        onChange={(e) => set("a", e.target.value)}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <span className="lowercase">vs</span>
      <select
        aria-label="second year"
        className={select}
        value={b}
        onChange={(e) => set("b", e.target.value)}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
