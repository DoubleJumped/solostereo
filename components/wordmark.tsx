import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The solostereo wordmark: lowercase Fraunces with an amber terminal dot.
 * Used in the nav (small) and as a hero mark on empty states (large).
 */
export function Wordmark({
  className,
  asLink = true,
}: {
  className?: string;
  asLink?: boolean;
}) {
  const mark = (
    <span
      className={cn(
        "font-display lowercase tracking-tight text-foreground",
        className,
      )}
    >
      solostereo<span className="text-primary">.</span>
    </span>
  );
  if (!asLink) return mark;
  return (
    <Link href="/" className="no-underline">
      {mark}
    </Link>
  );
}
