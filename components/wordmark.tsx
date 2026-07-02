import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The solostereo wordmark: dot-matrix LCD type with a phosphor terminal dot
 * (`solostereo.`). Used in the nav (small) and as a hero mark on empty
 * states (large).
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
      solostereo<span className="lcd-glow text-primary">.</span>
    </span>
  );
  if (!asLink) return mark;
  return (
    <Link href="/" className="no-underline">
      {mark}
    </Link>
  );
}
