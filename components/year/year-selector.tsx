import Link from "next/link";
import { chipClass } from "@/lib/utils";

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
          className={chipClass(y === active)}
        >
          {y}
        </Link>
      ))}
    </nav>
  );
}
