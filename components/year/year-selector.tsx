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
      className="flex flex-wrap gap-1 text-xs lowercase tracking-wide"
    >
      {years.map((y) => (
        <Link
          key={y}
          href={`/year?y=${y}${metric ? `&metric=${metric}` : ""}`}
          className={cn(
            "tabular rounded-full px-3 py-1 transition-colors",
            y === active
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {y}
        </Link>
      ))}
    </nav>
  );
}
