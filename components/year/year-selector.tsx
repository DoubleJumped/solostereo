import Link from "next/link";
import { cn } from "@/lib/utils";

/** Chips for every year present in the data (newest first). */
export function YearSelector({
  years,
  active,
  metric,
}: {
  years: number[];
  active: number;
  metric?: string;
}) {
  return (
    <nav
      aria-label="select year"
      className="flex flex-wrap gap-1 font-display text-base lowercase tracking-wide"
    >
      {years.map((y) => (
        <Link
          key={y}
          href={`/year?y=${y}${metric ? `&metric=${metric}` : ""}`}
          className={cn(
            "rounded-sm border px-3 py-0.5 transition-colors",
            y === active
              ? "border-primary/60 bg-primary/15 text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {y}
        </Link>
      ))}
    </nav>
  );
}
